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

import type { Matchers, Expect as RawExpect, MatcherState } from 'expect';

import { expect as originalExpect } from '@jest/globals';
import { Response } from 'node-fetch';

type CustomMatchers = Parameters<typeof originalExpect.extend>[0];
type PromiseVariant<T> = T extends Promise<infer R> ? Promise<R> : never;
type AsyncExpectationResult = PromiseVariant<ReturnType<CustomMatchers['fn']>>;

const customMatchers: CustomMatchers = {
    async toSuccessfullyReturn(
        this: MatcherState,
        received: unknown,
        expected: unknown,
    ): AsyncExpectationResult {
        const options = {
            comment: 'Response matching',
            isNot: this.isNot,
            promise: this.promise,
        };
        const matcherHint = this.utils.matcherHint(
            'toSuccessfullyReturn',
            undefined,
            undefined,
            options,
        );

        if (!(received instanceof Response)) {
            return {
                message: () =>
                    this.utils.matcherErrorMessage(
                        matcherHint,
                        `${this.utils.RECEIVED_COLOR(
                            'received',
                        )} value must be a Response`,
                        this.utils.printWithType(
                            'Received',
                            received,
                            this.utils.printReceived,
                        ),
                    ),
                pass: false,
            };
        }

        if (typeof expected === 'string') {
            const actual = await received.text();
            return {
                pass: expected === actual,
                message: () =>
                    this.utils.matcherErrorMessage(
                        matcherHint,
                        `${this.utils.RECEIVED_COLOR(
                            'received',
                        )} value must equal ${this.utils.EXPECTED_COLOR(
                            'expected',
                        )} value`,
                        this.utils.printDiffOrStringify(
                            expected,
                            actual,
                            'Expected text',
                            'Received test',
                            this.expand ?? false,
                        ),
                    ),
            };
        }

        const actual = await received.json();
        const expectedStr = this.utils.stringify(expected);
        const actualStr = this.utils.stringify(actual);
        return {
            pass: expectedStr === actualStr,
            message: () =>
                this.utils.matcherErrorMessage(
                    matcherHint,
                    `${this.utils.RECEIVED_COLOR(
                        'received',
                    )} value must equal ${this.utils.EXPECTED_COLOR(
                        'expected',
                    )} value`,
                    this.utils.printDiffOrStringify(
                        expected,
                        actual,
                        'Expected object',
                        'Received object',
                        this.expand ?? false,
                    ),
                ),
        };
    },
};

originalExpect.extend(customMatchers);

interface ExtendedMatchers<R extends void | Promise<void>> extends Matchers<R> {
    toSuccessfullyReturn(value: unknown): R;
}

type ExtendedPromiseMatchers = {
    /**
     * Unwraps the reason of a rejected promise so any other matcher can be
     * chained. If the promise is fulfilled the assertion fails.
     */
    rejects: ExtendedMatchers<Promise<void>>;
    /**
     * Unwraps the value of a fulfilled promise so any other matcher can be
     * chained. If the promise is rejected the assertion fails.
     */
    resolves: ExtendedMatchers<Promise<void>>;
};

export interface Expect extends RawExpect {
    <T = unknown>(actual: T): ExtendedMatchers<void> &
        ExtendedPromiseMatchers &
        ReturnType<typeof originalExpect>;
}

export const expect: Expect = originalExpect as unknown as Expect;
