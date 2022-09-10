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

import nodeFetch from 'node-fetch';
import { SelfThrottle } from 'self-throttle';

import { Duration, Instant, Now } from './temporal';

export type Fetch = typeof nodeFetch;

type BytesParams = {
    gigabytes?: number;
    megabytes?: number;
    kilobytes?: number;
    bytes?: number;
};

export class Bytes {
    readonly bytes: number;
    private constructor(bytes: number) {
        this.bytes = bytes;
    }

    static from(from: BytesParams): Bytes {
        const gigabytes = from.gigabytes ?? 0;
        const megabytes = gigabytes * 1024 + (from.megabytes ?? 0);
        const kilobytes = megabytes * 1024 + (from.megabytes ?? 0);
        const bytes = kilobytes * 1024 + (from.bytes ?? 0);
        return new Bytes(bytes);
    }
}

export type SnarfetchOptions = {
    fetch?: Fetch;
    throttle?: new () => SelfThrottle;
    gcInterval?: Duration;
    maximumStorageBytes?: Bytes;
    maximumStoragePerTargetBytes?: Bytes;
    now?: () => Instant;
};

export const SNARFETCH_DEFAULTS: Required<SnarfetchOptions> = {
    fetch: nodeFetch,
    throttle: SelfThrottle,
    gcInterval: Duration.from({ seconds: 60 }),
    maximumStorageBytes: Bytes.from({ megabytes: 200 }),
    maximumStoragePerTargetBytes: Bytes.from({ megabytes: 50 }),
    now: Now.instant,
} as const;
