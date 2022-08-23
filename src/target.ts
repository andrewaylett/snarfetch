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
import { Bytes, Fetch, SnarfetchOptions } from './options';
import { RequestInfo, RequestInit, Response } from 'node-fetch';
import { CacheRules, extractCacheRules } from './cacheRules';
import { Instant, Now } from './temporal';
import { GcMap } from './gcmap';

type Location = string;

abstract class LocationCacheStatus {
    abstract get lastUsed(): Instant;
    abstract get size(): Promise<number>;
    abstract get valid(): boolean;
}

class UnknownCacheStatus implements LocationCacheStatus {
    readonly unblock: Promise<unknown>;

    constructor(unblock: Promise<unknown>) {
        this.unblock = unblock;
    }

    get lastUsed(): Instant {
        return Now.instant();
    }

    get size(): Promise<number> {
        return Promise.resolve(0);
    }

    get valid(): boolean {
        return true;
    }
}

class NoStore implements LocationCacheStatus {
    get lastUsed(): Instant {
        return Now.instant();
    }

    get size(): Promise<number> {
        return Promise.resolve(0);
    }

    get valid(): boolean {
        return true;
    }
}

class Cached implements LocationCacheStatus {
    readonly #response: Promise<Response>;
    readonly #blob: Promise<Blob>;
    readonly #cacheRules: CacheRules;
    #lastUsed: Instant;

    constructor(response: Promise<Response>, cacheRules: CacheRules) {
        this.#blob = response.then((response) => response.blob());
        this.#response = response;
        this.#cacheRules = cacheRules;
        this.#lastUsed = Now.instant();
    }

    get response(): Promise<Response> {
        return this.#buildResponse();
    }

    async #buildResponse(): Promise<Response> {
        const blob = await this.#blob;
        const response = await this.#response;
        this.#lastUsed = Now.instant();
        return new Response(blob, {
            headers: response.headers.entries(),
            status: response.status,
            statusText: response.statusText,
        });
    }

    get lastUsed(): Instant {
        return this.#lastUsed;
    }

    get size(): Promise<number> {
        return this.#buildSize();
    }

    async #buildSize(): Promise<number> {
        const blob = await this.#blob;
        return blob.size;
    }

    get valid(): boolean {
        return this.validAt(Now.instant());
    }

    validAt(instant: Instant) {
        return this.#cacheRules.validAt(instant);
    }
}

class Fail implements LocationCacheStatus {
    get lastUsed(): Instant {
        return Now.instant();
    }

    get size(): Promise<number> {
        return Promise.resolve(0);
    }

    get valid(): boolean {
        return false;
    }
}

export class Target {
    readonly #throttle: SelfThrottle;
    readonly #fetch: Fetch;
    readonly #known: GcMap<Location, LocationCacheStatus> = new GcMap();
    #weightLimit: Bytes;
    #pendingGcResolves: Array<(n: number) => void> = [];

    constructor(options: Required<SnarfetchOptions>) {
        this.#throttle = new options.throttle();
        this.#fetch = this.#throttle.wrap(options.fetch);
        this.#weightLimit = options.maximumStoragePerTargetBytes;
    }

    async fetch(url: RequestInfo, init?: RequestInit): Promise<Response> {
        const { pathname, search } = extractTargetURL(url);
        const requestStart = Now.instant();
        const cacheKey: Location = `${pathname}${search}`;
        {
            // Do we need to wait?
            const cacheStatus = this.#known.get(cacheKey);
            if (cacheStatus && cacheStatus instanceof UnknownCacheStatus) {
                await cacheStatus.unblock;
            }
        }
        // If we waited, this should now be a known status
        let cacheStatus = this.#known.get(cacheKey);
        if (cacheStatus instanceof Cached) {
            if (cacheStatus.validAt(requestStart)) {
                const response = await cacheStatus.response;
                const duration = requestStart.since(Now.instant());
                response.headers.set(
                    'snarfetch-status',
                    `HIT in ${duration.milliseconds} ms`,
                );
                return response;
            }
            cacheStatus = undefined;
        }
        const promise = this.#fetch(url, init);
        const response = this.#postFetch(promise, cacheKey, requestStart);
        if (!cacheStatus) {
            this.#known.set(cacheKey, new UnknownCacheStatus(response));
        }
        return response;
    }

    async #postFetch(
        promise: Promise<Response>,
        cacheKey: Location,
        requestStart: Instant,
    ): Promise<Response> {
        const result: Response = await promise;
        const duration = requestStart.since(Now.instant());

        if (result.status >= 500) {
            this.#known.set(cacheKey, new Fail());
            return result;
        } else {
            const cacheRules = extractCacheRules(result);
            if (cacheRules.params.noStore) {
                result.headers.set(
                    'snarfetch-status',
                    `NOSTORE in ${duration.milliseconds} ms`,
                );
                this.#known.set(cacheKey, new NoStore());
                return result;
            } else {
                result.headers.set(
                    'snarfetch-status',
                    `MISS in ${duration.milliseconds} ms`,
                );
                const cache = new Cached(Promise.resolve(result), cacheRules);
                this.#known.set(cacheKey, cache);
                setImmediate(() => this.#scheduleGC());
                return cache.response;
            }
        }
    }

    async gc(limit: number): Promise<number> {
        this.#weightLimit = Bytes.from({ bytes: limit });
        return this.#scheduleGC();
    }

    async #scheduleGC(): Promise<number> {
        const limit = this.#weightLimit.bytes;
        const weight = await this.#known.weight((v) => v.size);
        if (weight <= limit) {
            return weight;
        }
        return new Promise((resolve) => {
            this.#pendingGcResolves.push(resolve);
            if (this.#pendingGcResolves.length == 1) {
                setImmediate(async () => {
                    const weight = await this.#known.gc(
                        limit,
                        (v) => v.lastUsed,
                        (v) =>
                            v.valid
                                ? v.size
                                : Promise.resolve(Number.POSITIVE_INFINITY),
                        Instant.compare,
                    );
                    let resolver;
                    while ((resolver = this.#pendingGcResolves.pop())) {
                        resolver(weight);
                    }
                });
            }
        });
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
