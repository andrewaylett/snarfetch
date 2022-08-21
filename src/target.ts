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

type Location = string;

class LocationCacheStatus {}

class UnknownCacheStatus implements LocationCacheStatus {
    readonly unblock: Promise<unknown>;

    constructor(unblock: Promise<unknown>) {
        this.unblock = unblock;
    }
}

class NoCache implements LocationCacheStatus {}

class IndeterminateCache implements LocationCacheStatus {
    readonly #response: Promise<Response>;
    readonly #blob: Promise<Blob>;
    valid: boolean;

    constructor(response: Promise<Response>) {
        this.#blob = response.then((response) => response.blob());
        this.#response = response;
        this.valid = true;
        setImmediate(() => {
            this.valid = false;
        });
    }

    get response(): Promise<Response> {
        return this.#buildResponse();
    }

    async #buildResponse(): Promise<Response> {
        const blob = await this.#blob;
        const response = await this.#response;
        return new Response(blob, {
            headers: response.headers.entries(),
            status: response.status,
            statusText: response.statusText,
        });
    }
}

class Fail implements LocationCacheStatus {}

export class Target {
    readonly #throttle: SelfThrottle;
    readonly #fetch: Fetch;
    readonly #known: Partial<Record<Location, LocationCacheStatus>> = {};

    constructor(options: Required<SnarfetchOptions>) {
        this.#throttle = new options.throttle();
        this.#fetch = this.#throttle.wrap(options.fetch);
    }

    async fetch(url: RequestInfo, init?: RequestInit): Promise<Response> {
        const { pathname, search } = extractTargetURL(url);
        const cacheKey: Location = `${pathname}${search}`;
        {
            // Do we need to wait?
            const cacheStatus = this.#known[cacheKey];
            if (cacheStatus && cacheStatus instanceof UnknownCacheStatus) {
                await cacheStatus.unblock;
            }
        }
        // If we waited, this should now be a known status
        let cacheStatus = this.#known[cacheKey];
        if (cacheStatus instanceof IndeterminateCache) {
            if (cacheStatus.valid) {
                return cacheStatus.response;
            }
            cacheStatus = undefined;
        }
        const promise = this.#fetch(url, init);
        const response = this.#postFetch(promise, cacheKey);
        if (!cacheStatus) {
            this.#known[cacheKey] = new UnknownCacheStatus(response);
        }
        return response;
    }

    async #postFetch(
        promise: Promise<Response>,
        cacheKey: Location,
    ): Promise<Response> {
        const result: Response = await promise;

        if (result.status >= 500) {
            this.#known[cacheKey] = new Fail();
            return result;
        } else {
            const cacheHeader = result.headers.get('cache-control') ?? '';
            const noCache = !cacheHeader
                .split(';')
                .map((value) => value.trim())
                .every((value) => value !== 'no-cache');
            if (noCache) {
                this.#known[cacheKey] = new NoCache();
                return result;
            } else {
                const cache = new IndeterminateCache(Promise.resolve(result));
                this.#known[cacheKey] = cache;
                return cache.response;
            }
        }
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
