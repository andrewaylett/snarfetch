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

import { Response } from 'node-fetch';
import { Duration, Instant, Now } from './temporal';

// Ref https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control

export type CacheRuleParameters = {
    maxAge: Duration;
    sMaxAge: Duration;
    noCache: boolean;
    mustRevalidate: boolean;
    proxyRevalidate: boolean;
    noStore: boolean;
    private: boolean;
    public: boolean;
    mustUnderstand: boolean;
    noTransform: boolean;
    immutable: boolean;
    staleWhileRevalidate: Duration;
    staleIfError: Duration;
    ageBase: Instant;
};

export class CacheRules {
    readonly params: CacheRuleParameters;
    constructor(params: Partial<CacheRuleParameters>) {
        this.params = { ...defaultRules(), ...params };
    }

    validAt(instant: Instant) {
        if (this.params.noCache || this.params.noStore) {
            return false;
        }
        if (this.params.immutable) {
            return true;
        }
        const expiry = this.params.ageBase.add(this.params.maxAge);
        return Instant.compare(instant, expiry) <= 0;
    }
}

export const defaultRules = (): CacheRuleParameters => ({
    maxAge: new Duration(),
    sMaxAge: new Duration(),
    noCache: false,
    mustRevalidate: false,
    proxyRevalidate: false,
    noStore: false,
    private: false,
    public: false,
    mustUnderstand: false,
    noTransform: false,
    immutable: false,
    staleWhileRevalidate: new Duration(),
    staleIfError: new Duration(),
    ageBase: Now.instant(),
});

export function extractCacheRules(result: Response): CacheRules {
    const cacheHeader = result.headers.get('cache-control') ?? '';
    const partialRules: Partial<CacheRuleParameters> = {};
    const rawRules = cacheHeader.split(';').map((value) => value.trim());

    for (const rawRule of rawRules) {
        const [splitRule, valueStr] = rawRule.split('=', 2);
        const rule = splitRule.toLowerCase();
        const value = Number.parseInt(valueStr, 10) ?? undefined;
        const duration = Duration.from({ seconds: value });
        switch (rule) {
            case 'max-age':
                partialRules.maxAge = duration;
                break;
            case 's-max-age':
                partialRules.sMaxAge = duration;
                break;
            case 'no-cache':
                partialRules.noCache = true;
                break;
            case 'must-revalidate':
                partialRules.mustRevalidate = true;
                break;
            case 'proxy-revalidate':
                partialRules.proxyRevalidate = true;
                break;
            case 'no-store':
                partialRules.noStore = true;
                break;
            case 'private':
                partialRules.private = true;
                break;
            case 'public':
                partialRules.public = true;
                break;
            case 'must-understand':
                partialRules.mustUnderstand = true;
                break;
            case 'no-transform':
                partialRules.noTransform = true;
                break;
            case 'immutable':
                partialRules.immutable = true;
                break;
            case 'stale-while-revalidate':
                partialRules.staleWhileRevalidate = duration;
                break;
            case 'stale-if-error':
                partialRules.staleIfError = duration;
                break;
            default:
            // Ignore unknown keys
        }
    }

    const ageStr = result.headers.get('age');
    if (ageStr) {
        const age = Number.parseInt(ageStr, 10) ?? 0;
        partialRules.ageBase = Now.instant().subtract({ seconds: age });
    }

    return new CacheRules(partialRules);
}
