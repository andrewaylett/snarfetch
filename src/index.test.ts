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

import { jest, expect, describe, it } from '@jest/globals';

import { Snarfetch } from './index';

import type nodeFetch from 'node-fetch';
import { Response } from 'node-fetch';
import { Fetch } from './options';

describe('Basic passthrough', () => {
    describe('On a clean context', () => {
        it('Passes through its parameters', async () => {
            const url = 'https://example.com/';
            const mockFetch = jest.fn<typeof nodeFetch>();
            const mockRv = Promise.resolve(
                new Response(Symbol().toString(), {
                    headers: { 'cache-control': 'no-cache' },
                }),
            );
            mockFetch.mockReturnValue(mockRv);
            const context = new Snarfetch({ fetch: mockFetch });

            const rv = context.fetch(url);

            await expect(rv).resolves.toBe(await mockRv);
            expect(mockFetch).toBeCalledWith(url, undefined);
        });
    });
});

const unlockable = <T>(result: T): [Promise<T>, () => void] => {
    let resolver: (result: T) => void;
    const promise = new Promise<T>((resolve) => {
        resolver = resolve;
    });
    return [
        promise,
        async () => {
            return new Promise((resolve) => {
                resolver(result);
                setImmediate(resolve);
            });
        },
    ];
};

describe('No Cache', () => {
    it("A first request blocks a second that's the same", async () => {
        // If we don't yet know whether a request is cacheable, delay a subsequent
        // request until the first returns -- either we'll issue it, or we'll
        // re-use the first response.
        const url = 'https://example.com/one';
        const unlocker = jest.fn<() => Promise<number>>();
        let returnId = 0;
        const fetch: Fetch = (async () => {
            const lockValue = await unlocker();
            const id = ++returnId;
            const rv = [lockValue, id] as const;
            return new Response(rv, {
                headers: { 'cache-control': 'no-cache' },
            });
        }) as unknown as Fetch;

        const [first, unlockFirst] = unlockable(1);
        const [second, unlockSecond] = unlockable(2);
        unlocker.mockReturnValueOnce(first);
        unlocker.mockReturnValueOnce(second);

        const context = new Snarfetch({ fetch });

        // Issue two requests
        const firstPromise = context.fetch(url);
        const secondPromise = context.fetch(url);

        // Allow the second to proceed before allowing the first
        await unlockSecond();
        await unlockFirst();

        // The second should have been blocked until the first completed
        const one = expect((await firstPromise).text()).resolves.toMatch('1,1');
        const two = expect((await secondPromise).text()).resolves.toMatch(
            '2,2',
        );
        await Promise.all([one, two]);
    });

    it('A first request does not blocks a different request', async () => {
        // If we don't yet know whether a request is cacheable, delay a subsequent
        // request until the first returns -- either we'll issue it, or we'll
        // re-use the first response.
        const url1 = 'https://example.com/one';
        const url2 = 'https://example.com/two';
        const unlocker = jest.fn<() => Promise<number>>();
        let returnId = 0;
        const fetch: Fetch = (async () => {
            const lockValue = await unlocker();
            const id = ++returnId;
            const rv = [lockValue, id] as const;
            return new Response(rv);
        }) as unknown as Fetch;

        const [first, unlockFirst] = unlockable(1);
        const [second, unlockSecond] = unlockable(2);
        unlocker.mockReturnValueOnce(first);
        unlocker.mockReturnValueOnce(second);

        const context = new Snarfetch({ fetch });

        // Issue two requests
        const firstPromise = context.fetch(url1);
        const secondPromise = context.fetch(url2);

        // Allow the second to proceed before allowing the first
        await unlockSecond();
        await unlockFirst();

        // The second should have been blocked until the first completed
        const one = expect((await firstPromise).text()).resolves.toMatch('1,2');
        const two = expect((await secondPromise).text()).resolves.toMatch(
            '2,1',
        );
        await Promise.all([one, two]);
    });
});

describe('Indeterminate cache', () => {
    it("A first request fulfils a second that's the same", async () => {
        // If we don't yet know whether a request is cacheable, delay a subsequent
        // request until the first returns -- either we'll issue it, or we'll
        // re-use the first response.
        const url = 'https://example.com/one';
        let returnId = 0;
        const fetch: Fetch = (async () => {
            const id = ++returnId;
            return new Response(id);
        }) as unknown as Fetch;

        const context = new Snarfetch({ fetch });

        // Issue two requests
        const firstPromise = context.fetch(url);
        const secondPromise = context.fetch(url);

        // The second should have the same result as the first
        const one = expect((await firstPromise).text()).resolves.toMatch('1');
        const two = expect((await secondPromise).text()).resolves.toMatch('1');
        await Promise.all([one, two]);
    });

    it('Non-concurrent requests are made separately', async () => {
        // If we don't yet know whether a request is cacheable, delay a subsequent
        // request until the first returns -- either we'll issue it, or we'll
        // re-use the first response.
        const url = 'https://example.com/one';
        let returnId = 0;
        const fetch: Fetch = (async () => {
            const id = ++returnId;
            return new Response(id);
        }) as unknown as Fetch;

        const context = new Snarfetch({ fetch });

        // Issue two requests
        const firstPromise = context.fetch(url);
        const one = expect((await firstPromise).text()).resolves.toMatch('1');

        await new Promise((resolve) => setImmediate(resolve));

        const secondPromise = context.fetch(url);
        const two = expect((await secondPromise).text()).resolves.toMatch('2');
        await Promise.all([one, two]);
    });

    it('first request not no-cache, second request is no-cache', async () => {
        // If we don't yet know whether a request is cacheable, delay a subsequent
        // request until the first returns -- either we'll issue it, or we'll
        // re-use the first response.
        const url = 'https://example.com/one';
        let returnId = 0;
        const fetch: Fetch = (async () => {
            const id = ++returnId;
            const headers =
                id === 1
                    ? {
                          'cache-control': 'must-revalidate',
                      }
                    : {
                          'cache-control': 'no-cache',
                      };
            return new Response(id, { headers });
        }) as unknown as Fetch;

        const context = new Snarfetch({ fetch });

        // Issue two requests
        const firstPromise = context.fetch(url);
        const one = expect((await firstPromise).text()).resolves.toMatch('1');

        await new Promise((resolve) => setImmediate(resolve));

        const secondPromise = context.fetch(url);
        const thirdPromise = context.fetch(url);
        const two = expect((await secondPromise).text()).resolves.toMatch('2');
        const three = expect((await thirdPromise).text()).resolves.toMatch('3');
        await Promise.all([one, two, three]);
    });
});
