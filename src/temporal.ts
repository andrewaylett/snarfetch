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

// The bits of the new Temporal API that I actually need

export class Now {
    static instant(): Instant {
        return new Instant(Date.now());
    }
}

export class Duration {
    readonly milliseconds: number;
    constructor(milliseconds = 0) {
        this.milliseconds = milliseconds;
    }

    get seconds(): number {
        return this.milliseconds / 1000;
    }

    static from(param: { seconds?: number; milliseconds?: number }) {
        return new Duration(
            (param.seconds ?? 0) * 1000 + (param.milliseconds ?? 0),
        );
    }
}

export class Instant {
    #timestamp: number;
    constructor(timestamp: number) {
        this.#timestamp = timestamp;
    }

    static compare(a: Instant, b: Instant): number {
        const diff = a.#timestamp - b.#timestamp;
        return Math.sign(diff);
    }

    add(d: Duration): Instant {
        return new Instant(this.#timestamp + d.milliseconds);
    }

    since(other: Instant): Duration {
        return new Duration(other.#timestamp - this.#timestamp);
    }

    subtract(d: { seconds?: number; milliseconds?: number }) {
        return new Instant(
            this.#timestamp - (d.seconds ?? 0) * 1000 - (d.milliseconds ?? 0),
        );
    }
}
