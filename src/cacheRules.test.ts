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

import { describe, it, expect } from '@jest/globals';
import { Response } from 'node-fetch';
import { extractCacheRules } from './cacheRules';

describe('Validity', () => {
    it('No headers is immediately valid', () => {
        const res = new Response();

        const cacheRules = extractCacheRules(res);

        expect(cacheRules.validAt(cacheRules.params.ageBase)).toBeTruthy();
    });

    it('No headers will be invalid 1ms later', () => {
        const res = new Response();

        const cacheRules = extractCacheRules(res);

        expect(
            cacheRules.validAt(
                cacheRules.params.ageBase.add({ milliseconds: 1 }),
            ),
        ).toBeFalsy();
    });

    it('No headers will be valid 1ms earlier', () => {
        const res = new Response();

        const cacheRules = extractCacheRules(res);

        expect(
            cacheRules.validAt(
                cacheRules.params.ageBase.subtract({ milliseconds: 1 }),
            ),
        ).toBeTruthy();
    });
});
