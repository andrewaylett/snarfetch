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
 *
 */

import type { RequestInfo, RequestInit } from 'node-fetch';
import nodeFetch from 'node-fetch';
import { lookupGlobalInstance } from './global';

export class Snarfetch {
    readonly #fetch: typeof nodeFetch;

    constructor(fetch: typeof nodeFetch = nodeFetch) {
        this.#fetch = fetch;
    }

    fetch(url: RequestInfo, init?: RequestInit) {
        return this.#fetch(url, init);
    }
}

const fetch: typeof nodeFetch = (url: RequestInfo, init?: RequestInit) => {
    return lookupGlobalInstance().fetch(url, init);
};

export default fetch;
