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

import type { Expect as RawExpect, Matchers, MatcherState } from 'expect';

import { expect as originalExpect } from '@jest/globals';
import { Response } from 'node-fetch';

type CustomMatchers = Parameters<typeof originalExpect.extend>[0];
type PromiseVariant<T> = T extends Promise<infer R> ? Promise<R> : never;
type SyncVariant<T> = T extends Promise<unknown> ? never : T;
type AsyncExpectationResult = PromiseVariant<ReturnType<CustomMatchers['fn']>>;
type SyncExpectationResult = SyncVariant<ReturnType<CustomMatchers['fn']>>;

function notAResponseError(
    utils: MatcherState['utils'],
    matcherHint: string,
    received: unknown,
): SyncExpectationResult {
    return {
        message: () =>
            utils.matcherErrorMessage(
                matcherHint,
                `${utils.RECEIVED_COLOR('received')} value must be a Response`,
                utils.printWithType('Received', received, utils.printReceived),
            ),
        pass: false,
    };
}

function checkCacheStatus(
    this: MatcherState,
    matcherName: string,
    options: { isNot: boolean; comment: string; promise: string },
    received: unknown,
    headerPrefix: string,
) {
    const matcherHint = this.utils.matcherHint(
        matcherName,
        undefined,
        undefined,
        options,
    );

    if (!(received instanceof Response)) {
        return notAResponseError(this.utils, matcherHint, received);
    }

    const status = received.headers.get('snarfetch-status');

    if (!status) {
        return {
            message: () =>
                this.utils.matcherErrorMessage(
                    matcherHint,
                    `${this.utils.RECEIVED_COLOR(
                        'received',
                    )} value must be a Response returned from Snarfetch, but ` +
                        `lacks the snarfetch-status header`,
                    this.utils.printWithType(
                        'Received',
                        received,
                        this.utils.printReceived,
                    ),
                ),
            pass: false,
        };
    }

    if (status.startsWith(headerPrefix)) {
        return {
            message: () =>
                this.utils.matcherErrorMessage(
                    matcherHint,
                    `${this.utils.RECEIVED_COLOR(
                        'received',
                    )} value starts with the correct string`,
                    this.utils.printWithType(
                        'snarfetch-status header',
                        status,
                        this.utils.printReceived,
                    ),
                ),
            pass: true,
        };
    } else {
        return {
            pass: false,
            message: () =>
                this.utils.matcherErrorMessage(
                    matcherHint,
                    `${this.utils.RECEIVED_COLOR(
                        'received',
                    )} value must equal ${this.utils.EXPECTED_COLOR(
                        'expected',
                    )} value`,
                    this.utils.printDiffOrStringify(
                        headerPrefix,
                        status,
                        'Expected snarfetch-status header to start with',
                        'Received snarfetch-status header was',
                        this.expand ?? false,
                    ),
                ),
        };
    }
}

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
            return notAResponseError(this.utils, matcherHint, received);
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

    toBeCached(this: MatcherState, received: unknown): SyncExpectationResult {
        const options = {
            comment: 'Response matching',
            isNot: this.isNot,
            promise: this.promise,
        };
        const matcherName = 'toBeCached';
        const headerPrefix = 'HIT';
        return checkCacheStatus.call(
            this,
            matcherName,
            options,
            received,
            headerPrefix,
        );
    },

    toBeCacheMiss(
        this: MatcherState,
        received: unknown,
    ): SyncExpectationResult {
        const options = {
            comment: 'Response matching',
            isNot: this.isNot,
            promise: this.promise,
        };
        const matcherName = 'toBeCacheMiss';
        const headerPrefix = 'MISS';
        return checkCacheStatus.call(
            this,
            matcherName,
            options,
            received,
            headerPrefix,
        );
    },

    toBeNotCacheable(
        this: MatcherState,
        received: unknown,
    ): SyncExpectationResult {
        const options = {
            comment: 'Response matching',
            isNot: this.isNot,
            promise: this.promise,
        };
        const matcherName = 'toBeNotCacheable';
        const headerPrefix = 'NOSTORE';
        return checkCacheStatus.call(
            this,
            matcherName,
            options,
            received,
            headerPrefix,
        );
    },
};

originalExpect.extend(customMatchers);

interface ExtendedMatchers<R extends void | Promise<void>> extends Matchers<R> {
    toSuccessfullyReturn(value: unknown): R;
    toBeCached(): R;
    toBeCacheMiss(): R;
    toBeNotCacheable(): R;
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
