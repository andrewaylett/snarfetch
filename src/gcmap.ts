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

import { Generators } from './index';

function* addKey<V, S>(
    entries: Iterable<V>,
    sortKey: (v: V) => S,
): IterableIterator<[S, V]> {
    for (const v of entries) {
        yield [sortKey(v), v];
    }
}

function* removeKey<V>(entries: Iterable<[unknown, V]>): IterableIterator<V> {
    for (const [_, v] of entries) {
        yield v;
    }
}

export function sortByKey<V, S>(
    collection: Iterable<V>,
    sortKey: (v: V) => S,
    comparator: (a: S, b: S) => number,
): Iterable<V>;
export function sortByKey<V>(
    collection: Iterable<V>,
    sortKey: (v: V) => number,
): Iterable<V>;
export function sortByKey<V, S = number>(
    collection: Iterable<V>,
    sortKey: (v: V) => S,
    comparator?: (a: S, b: S) => number,
): Iterable<V> {
    const withKeys = addKey(collection, sortKey);
    // comparator may only be undefined if S is number, but TS can't validate that
    const compareFn = comparator
        ? ([a]: [S, V], [b]: [S, V]) => comparator(a, b)
        : ((([a]: [number, V], [b]: [number, V]) =>
              Math.sign(a - b)) as unknown as (
              [a]: [S, V],
              [b]: [S, V],
          ) => number);
    const sorted = [...withKeys].sort(compareFn);
    return removeKey(sorted);
}

export const gc = async <K, V, S>(
    entries: IterableIterator<[K, V]>,
    sortKey: (v: V) => S,
    sortKeyComparer: (a: S, b: S) => number,
    weigher: (v: V) => Promise<number>,
    limit: number,
    deleter: (k: K) => void,
): Promise<number> => {
    // Latest first
    const sorted = sortByKey(
        entries,
        ([_, v]) => sortKey(v),
        (a: S, b: S) => -sortKeyComparer(a, b),
    );

    let runningSize = 0;
    for (const [key, value] of sorted) {
        const size = await weigher(value);
        if (runningSize + size > limit) {
            deleter(key);
            continue;
        }

        runningSize += size;
    }
    return runningSize;
};

export class GcMap<K, V> extends Map<K, V> {
    gc<S>(
        limit: number,
        sortKey: (v: V) => S,
        weigher: (v: V) => Promise<number>,
        sortKeyComparer: (a: S, b: S) => number,
    ): Promise<number> {
        const entries = this.entries();
        const deleter = this.delete.bind(this);
        return gc(entries, sortKey, sortKeyComparer, weigher, limit, deleter);
    }

    async weight(weigher: (v: V) => Promise<number>): Promise<number> {
        const weights = await Promise.all(
            Generators.map(this.values(), weigher),
        );
        return weights.reduce((a, b) => a + b);
    }
}
