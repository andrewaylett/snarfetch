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

import { SelfThrottle } from 'self-throttle';
import { Fetch, SnarfetchOptions } from './options';
import { RequestInfo, RequestInit, Response } from 'node-fetch';

type CacheKey = string;

class CacheEntry {}

class UnknownCacheStatus implements CacheEntry {
    readonly unblock: Promise<unknown>;

    constructor(unblock: Promise<unknown>) {
        this.unblock = unblock;
    }
}

class NoCache implements CacheEntry {}

class IndeterminateCache implements CacheEntry {}

class Fail implements CacheEntry {}

export class Target {
    readonly #throttle: SelfThrottle;
    readonly #fetch: Fetch;
    readonly #known: Partial<Record<CacheKey, CacheEntry>> = {};

    constructor(options: Required<SnarfetchOptions>) {
        this.#throttle = new options.throttle();
        this.#fetch = this.#throttle.wrap(options.fetch);
    }

    async fetch(url: RequestInfo, init?: RequestInit): Promise<Response> {
        const { pathname, search } = extractTargetURL(url);
        const cacheKey: CacheKey = `${pathname}${search}`;
        {
            const cacheStatus = this.#known[cacheKey];
            if (cacheStatus && cacheStatus instanceof UnknownCacheStatus) {
                await cacheStatus.unblock;
            }
        }
        const cacheStatus = this.#known[cacheKey];
        let promise;
        if (!cacheStatus) {
            promise = this.#fetch(url, init);
            this.#known[cacheKey] = new UnknownCacheStatus(promise);
        } else {
            promise = this.#fetch(url, init);
        }
        const result: Response = await promise;

        if (result.status >= 500) {
            this.#known[cacheKey] = new Fail();
        } else {
            const cacheHeader = result.headers.get('cache-control') ?? '';
            const noCache = !cacheHeader
                .split(';')
                .map((value) => value.trim())
                .every((value) => value !== 'no-cache');
            if (noCache) {
                this.#known[cacheKey] = new NoCache();
            } else {
                this.#known[cacheKey] = new IndeterminateCache();
            }
        }

        return result;
    }
}

const extractTargetURL = (source: RequestInfo): URL => {
    if (typeof source === 'string') {
        return new URL(source);
    }
    return new URL(source.url);
};

export type TargetKey = `${string}:${string}`;

export const extractTargetKey = (source: RequestInfo): TargetKey => {
    const { host, port } = extractTargetURL(source);
    return `${host}:${port}`;
};
