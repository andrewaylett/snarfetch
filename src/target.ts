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

export class Target {
    readonly #throttle: SelfThrottle;
    readonly #fetch: Fetch;

    constructor(options: Required<SnarfetchOptions>) {
        this.#throttle = new options.throttle();
        this.#fetch = this.#throttle.wrap(options.fetch);
    }

    fetch(url: RequestInfo, init?: RequestInit): Promise<Response> {
        return this.#fetch(url, init);
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
