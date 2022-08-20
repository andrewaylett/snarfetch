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

import type { RequestInfo, RequestInit } from 'node-fetch';
import { lookupGlobalInstance } from './global';
import { Fetch, SNARFETCH_DEFAULTS, SnarfetchOptions } from './options';
import { extractTargetKey, Target, TargetKey } from './target';

export class Snarfetch {
    readonly #targets: Partial<Record<TargetKey, Target>> = {};
    readonly #options: Required<SnarfetchOptions>;

    constructor(options: SnarfetchOptions = {}) {
        this.#options = { ...SNARFETCH_DEFAULTS, ...options };
    }

    fetch(url: RequestInfo, init?: RequestInit) {
        const target = this.#getTarget(url);
        return target.fetch(url, init);
    }

    #getTarget(url: RequestInfo): Target {
        const key = extractTargetKey(url);
        const target: Target | undefined = this.#targets[key];
        if (target) {
            return target;
        }
        const newTarget = new Target(this.#options);
        this.#targets[key] = newTarget;
        return newTarget;
    }
}

const fetch: Fetch = (url: RequestInfo, init?: RequestInit) => {
    return lookupGlobalInstance().fetch(url, init);
};

export default fetch;
