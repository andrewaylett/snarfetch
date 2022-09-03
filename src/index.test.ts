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

import { jest, describe, it } from '@jest/globals';
import { expect } from './test/expect';

import { Snarfetch } from './index';

import type nodeFetch from 'node-fetch';
import { Response } from 'node-fetch';
import { Fetch } from './options';
import { Instant } from './temporal';

const nextTick = () =>
    new Promise<void>((resolve) => {
        const then = Date.now();
        const wait = () => {
            if (Date.now() > then) {
                resolve();
            } else {
                setImmediate(wait);
            }
        };
        wait();
    });

describe('Basic passthrough', () => {
    describe('On a clean context', () => {
        it('Passes through its parameters', async () => {
            const url = 'https://example.com/';
            const mockFetch = jest.fn<typeof nodeFetch>();
            const body = Symbol().toString();
            const mockRv = Promise.resolve(
                new Response(body, {
                    headers: { 'cache-control': 'no-cache' },
                }),
            );
            mockFetch.mockReturnValue(mockRv);
            const context = new Snarfetch({ fetch: mockFetch });

            const rv = context.fetch(url);

            await expect(rv).resolves.toSuccessfullyReturn(body);
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
        // If we don't yet know whether a request is cacheable, delay a
        // subsequent request until the first returns -- either we'll issue it,
        // or we'll re-use the first response.
        const url = 'https://example.com/one';
        const unlocker = jest.fn<() => Promise<number>>();
        let returnId = 0;
        const fetch: Fetch = (async () => {
            const lockValue = await unlocker();
            const id = ++returnId;
            const rv = [lockValue, id] as const;
            return new Response(JSON.stringify(rv), {
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

        await nextTick();

        await unlockFirst();

        // The second should have been blocked until the first completed
        const one = expect(firstPromise).resolves.toSuccessfullyReturn([1, 1]);
        const two = expect(secondPromise).resolves.toSuccessfullyReturn([2, 2]);
        await Promise.all([one, two]);
    });

    it('A first request does not blocks a different request', async () => {
        const url1 = 'https://example.com/one';
        const url2 = 'https://example.com/two';
        const unlocker = jest.fn<() => Promise<number>>();
        let returnId = 0;
        const fetch: Fetch = (async () => {
            const lockValue = await unlocker();
            const id = ++returnId;
            const rv = [lockValue, id] as const;
            return new Response(JSON.stringify(rv));
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
        const one = expect(firstPromise).resolves.toSuccessfullyReturn([1, 2]);
        const two = expect(secondPromise).resolves.toSuccessfullyReturn([2, 1]);
        await Promise.all([one, two]);
    });
});

describe('Indeterminate cache', () => {
    it("A first request fulfils a second that's the same", async () => {
        const url = 'https://example.com/one';
        let returnId = 0;
        const fetch: Fetch = (async () => {
            const id = ++returnId;
            return new Response(`${id}`);
        }) as unknown as Fetch;

        const context = new Snarfetch({ fetch });

        // Issue two requests
        const firstPromise = context.fetch(url);
        const secondPromise = context.fetch(url);

        // The second should have the same result as the first
        await expect(firstPromise).resolves.toSuccessfullyReturn('1');
        await expect(firstPromise).resolves.toBeCacheMiss();
        await expect(secondPromise).resolves.toSuccessfullyReturn('1');
        await expect(secondPromise).resolves.toBeCached();
    });

    it('Non-concurrent requests are made separately', async () => {
        const url = 'https://example.com/one';
        let returnId = 0;
        const fetch: Fetch = (async () => {
            const id = ++returnId;
            return new Response(`${id}`);
        }) as unknown as Fetch;

        const context = new Snarfetch({ fetch });

        // Issue two requests
        const firstPromise = context.fetch(url);
        await expect(firstPromise).resolves.toSuccessfullyReturn('1');
        await expect(firstPromise).resolves.toBeCacheMiss();

        await nextTick();

        const secondPromise = context.fetch(url);
        await expect(secondPromise).resolves.toSuccessfullyReturn('2');
        await expect(secondPromise).resolves.toBeCacheMiss();
    });

    it('first request not no-store, second request is no-cache', async () => {
        const url = 'https://example.com/one';
        let returnId = 0;
        const fetch: Fetch = (async () => {
            const id = ++returnId;
            const headers = {
                'cache-control': id === 1 ? 'must-revalidate' : 'no-store',
            };
            return new Response(`${id}`, { headers });
        }) as unknown as Fetch;

        const context = new Snarfetch({ fetch });

        // Issue two requests
        const firstPromise = context.fetch(url);
        await expect(firstPromise).resolves.toSuccessfullyReturn('1');
        await expect(firstPromise).resolves.toBeCacheMiss();

        await nextTick();

        const secondPromise = context.fetch(url);
        const thirdPromise = context.fetch(url);
        await expect(secondPromise).resolves.toSuccessfullyReturn('2');
        await expect(secondPromise).resolves.toBeNotCacheable();
        await expect(thirdPromise).resolves.toSuccessfullyReturn('3');
        await expect(thirdPromise).resolves.toBeNotCacheable();
    });
});

describe('Expiring in turn', () => {
    it('Sets an age header', async () => {
        const url = 'https://example.com';
        const now = jest.fn<() => Instant>();
        now.mockReturnValue(new Instant(0));

        const fetch: Fetch = (async () => {
            const headers = {
                'cache-control': 'max-age=60',
            };
            return new Response(undefined, { headers });
        }) as unknown as Fetch;

        const context = new Snarfetch({ fetch, now });
        const one = context.fetch(url);
        await expect(one).resolves.toSuccessfullyReturn('');
        await expect(one).resolves.toBeCacheMiss();
        await expect(one).resolves.withHeaders({
            'cache-control': 'max-age=60',
        });

        now.mockReturnValue(new Instant(10_000));

        const two = context.fetch(url);
        await expect(two).resolves.toSuccessfullyReturn('');
        await expect(two).resolves.toBeCached();
        await expect(two).resolves.withHeaders({
            'cache-control': 'max-age=60',
            age: '10',
        });
    });
});
