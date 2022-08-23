/*
 * Copyright 2022 Andrew Aylett
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, it } from '@jest/globals';

import { expect } from '../test/expect';
import { gc, sortByKey } from './gcmap';

describe('Sort by key', () => {
    it('retains an identity sort', () => {
        const input = [0, 1, 2, 3, 4];
        const output = sortByKey(input, (v) => v);

        expect([...output]).toEqual(input);
    });

    it('sorts by absolute value', () => {
        const input = [-2, -1, 0, 1, 2];
        const output = sortByKey(input, (v) => Math.abs(v));

        expect([...output]).toEqual([0, -1, 1, -2, 2]);
    });

    it('sorts by sub-value', () => {
        const input: Array<[number, number]> = [
            [4, 0],
            [2, 1],
            [7, 2],
            [-1, 3],
        ];
        const output = [...sortByKey(input, (v) => v[1])];
        expect(output).toEqual(input);

        const mangled = output.sort();
        expect(mangled).not.toEqual(input);
        const resort = sortByKey(mangled, (v) => v[1]);
        expect([...resort]).toEqual(input);
    });
});

describe('Garbage collection', () => {
    // Inputs are transformed into entries such that the entry key is the array position
    // The value will be used as the weight.
    // The output is an array of weights removed
    it.each([
        [[0, 1, 2, 3, 4], 20, []],
        [[0, 1, 2, 3, 4], 9, [1]],
        [[1, 1, 1, 4, 1], 3, [4, 1]],
    ])(
        'Input %p with limit %p means removing %p',
        async (input: number[], limit: number, output: number[]) => {
            const deleted: number[] = [];
            const deleter = (n: number) => deleted.push(n);
            function* makeEntries(
                input: Iterable<number>,
            ): IterableIterator<[number, [number, number]]> {
                let i = 0;
                for (const el of input) {
                    yield [el, [i++, el]];
                }
            }
            await gc(
                makeEntries(input),
                (v) => v[0],
                (a, b) => Math.sign(a - b),
                (v) => Promise.resolve(v[1]),
                limit,
                deleter,
            );

            expect(deleted).toEqual(output);
        },
    );

    it('Prefers to remove older entries', async () => {
        const input: Array<[number, number]> = [
            [0, 2], // Will not be evicted, despite coming 'after' an over-limit entry
            [1, 4],
            [2, 0], // the earliest, also takes us over the weight limit
            [3, 1],
            [4, 3], // over limit, but we can fit in more after considering it
        ];
        const deleted: number[] = [];
        const deleter = (n: number) => deleted.push(n);
        function* makeEntries<K extends [number, number]>(
            input: Iterable<K>,
        ): IterableIterator<[number, K]> {
            for (const el of input) {
                yield [el[0], el];
            }
        }
        await gc(
            makeEntries(input),
            (v) => v[1],
            (a, b) => Math.sign(a - b),
            (v) => Promise.resolve(v[0]),
            4,
            deleter,
        );

        expect(deleted).toEqual([4, 2]);
    });
});
