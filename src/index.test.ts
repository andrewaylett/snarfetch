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

import { jest, expect, describe, it } from '@jest/globals';

import { Snarfetch } from './index';

import type nodeFetch from 'node-fetch';
import type { Response } from 'node-fetch';

describe('Basic passthrough', () => {
    describe('On a clean context', () => {
        it('Passes through its parameters', async () => {
            const url: string = Symbol() as unknown as string;
            const mockFetch = jest.fn<typeof nodeFetch>();
            const mockRv = Promise.resolve(Symbol() as unknown as Response);
            mockFetch.mockReturnValue(mockRv);
            const context = new Snarfetch(mockFetch);

            const rv = context.fetch(url);

            await expect(rv).resolves.toBe(await mockRv);
            expect(mockFetch).toBeCalledWith(url, undefined);
        });
    });
});
