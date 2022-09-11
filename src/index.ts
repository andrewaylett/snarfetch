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

import { lookupGlobalInstance } from './global.js';
import { Fetch, SNARFETCH_DEFAULTS, SnarfetchOptions } from './options.js';
import { extractTargetKey, Target, TargetKey } from './target.js';
import { Instant } from './temporal.js';
import { sortByKey } from './gcmap.js';

import type { RequestInfo, RequestInit } from 'node-fetch';

function* mapGenerator<I, O>(
    input: Iterable<I>,
    transform: (input: I) => O,
): IterableIterator<O> {
    for (const item of input) {
        yield transform(item);
    }
}

export const Generators = {
    mapGenerator,
};

export class Snarfetch {
    readonly #targets: Map<TargetKey, Target> = new Map();
    readonly #options: Required<SnarfetchOptions>;
    #nextGc: Instant;
    #gcInProgress = false;

    constructor(options: SnarfetchOptions = {}) {
        this.#options = { ...SNARFETCH_DEFAULTS, ...options };
        this.#nextGc = this.#options.now();
    }

    fetch(url: RequestInfo, init?: RequestInit) {
        this.#maybeGc();
        const target = this.#getTarget(url);
        return target.fetch(url, init);
    }

    #getTarget(url: RequestInfo): Target {
        const key = extractTargetKey(url);
        const target: Target | undefined = this.#targets.get(key);
        if (target) {
            return target;
        }
        const newTarget = new Target(this.#options);
        this.#targets.set(key, newTarget);
        return newTarget;
    }

    #maybeGc() {
        if (
            this.#gcInProgress ||
            Instant.compare(this.#options.now(), this.#nextGc) < 0
        ) {
            return;
        }
        this.#gcInProgress = true;
        setImmediate(async () => {
            const targetAndPromise = Generators.mapGenerator(
                this.#targets.values(),
                (target): [Target, Promise<number>] => [
                    target,
                    target.gc(this.#options.maximumStoragePerTargetBytes.bytes),
                ],
            );

            const targets = await Promise.all(
                Generators.mapGenerator(
                    targetAndPromise,
                    ([target, promise]): Promise<[Target, number]> =>
                        promise.then((n) => [target, n]),
                ),
            );

            const total = targets.reduce((a, [_, b]) => a + b, 0);
            let maximum = this.#options.maximumStorageBytes.bytes;
            if (total > maximum) {
                // We need to further restrict our storage
                const sorted = [...sortByKey(targets, ([_, t]) => t)];
                // Shift away any that are using less than their fair amoun
                while (maximum / sorted.length > sorted[0][1]) {
                    const shifted = sorted.shift();
                    if (!shifted) {
                        throw new Error('Shifted out all of the targets');
                    }

                    const [_, t] = shifted;
                    maximum -= t;
                }
                const newLimit = maximum / sorted.length;
                await Promise.all(
                    Generators.mapGenerator(sorted, ([target]) =>
                        target.gc(newLimit),
                    ),
                );
                this.#gcInProgress = false;
                this.#nextGc = this.#options
                    .now()
                    .add(this.#options.gcInterval);
            }
        });
    }
}

const fetch: Fetch = (url: RequestInfo, init?: RequestInit) => {
    return lookupGlobalInstance().fetch(url, init);
};

export default fetch;
