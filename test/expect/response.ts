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

import { BodyInit, Headers, HeadersInit, Response } from 'node-fetch';
import { MatchersFor, MatcherState, ExpectationResult } from 'extend-expect';

function notAResponseError(
    utils: MatcherState['utils'],
    matcherHint: string,
    received: unknown,
): ExpectationResult {
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
    options: { isNot?: boolean; comment?: string; promise?: string },
    received: unknown,
    headerPrefix: string,
): ExpectationResult {
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

    return status.startsWith(headerPrefix)
        ? {
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
          }
        : {
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

export function toBeCached(
    this: MatcherState,
    received: unknown,
    expected: unknown,
): ExpectationResult {
    const options = {
        comment: 'Response matching',
        isNot: this.isNot,
        promise: this.promise,
    };
    const matcherName = 'toBeCached';
    this.utils.ensureNoExpected(expected, matcherName, options);
    const headerPrefix = 'HIT';
    return checkCacheStatus.call(
        this,
        matcherName,
        options,
        received,
        headerPrefix,
    );
}

export async function toSuccessfullyReturn(
    this: MatcherState,
    received: unknown,
    expected: unknown,
): Promise<ExpectationResult> {
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
    const expectedString = this.utils.stringify(expected);
    const actualString = this.utils.stringify(actual);
    return {
        pass: expectedString === actualString,
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
}

function toBeCacheMiss(
    this: MatcherState,
    received: unknown,
    expected: unknown,
): ExpectationResult {
    const options = {
        comment: 'Response matching',
        isNot: this.isNot,
        promise: this.promise,
    };
    const matcherName = 'toBeCacheMiss';
    this.utils.ensureNoExpected(expected, matcherName, options);
    const headerPrefix = 'MISS';
    return checkCacheStatus.call(
        this,
        matcherName,
        options,
        received,
        headerPrefix,
    );
}

function prettyHeaders(headers: Headers): unknown {
    const raw = headers.raw();
    return Object.fromEntries(
        Object.entries(raw).map(([key, value]) => [
            key,
            value.length === 1 ? value[0] : value,
        ]),
    );
}

function toBeNotCacheable(
    this: MatcherState,
    received: unknown,
    expected: unknown,
): ExpectationResult {
    const options = {
        comment: 'Response matching',
        isNot: this.isNot,
        promise: this.promise,
    };
    const matcherName = 'toBeNotCacheable';
    this.utils.ensureNoExpected(expected, matcherName, options);
    const headerPrefix = 'NOSTORE';
    return checkCacheStatus.call(
        this,
        matcherName,
        options,
        received,
        headerPrefix,
    );
}

function withHeaders(
    this: MatcherState,
    received: unknown,
    expected: unknown,
): ExpectationResult {
    const options = {
        comment: 'Matches Headers',
        isNot: this.isNot,
        promise: this.promise,
    };
    const matcherHint = this.utils.matcherHint(
        'withHeaders',
        undefined,
        undefined,
        options,
    );

    if (!(received instanceof Response)) {
        return notAResponseError(this.utils, matcherHint, received);
    }

    const expectedHeaders = new Headers(expected as HeadersInit);
    const receivedHeaders = received.headers;

    let pass = true;
    for (const [name, value] of expectedHeaders.entries()) {
        if (receivedHeaders.get(name) !== value) {
            pass = false;
            break;
        }
    }

    return {
        pass,
        message: () =>
            this.utils.matcherErrorMessage(
                matcherHint,
                `${this.utils.RECEIVED_COLOR('received headers')} did ${
                    pass ? '' : 'not '
                }match all the headers ${this.utils.EXPECTED_COLOR(
                    'expected',
                )}`,
                this.utils.printDiffOrStringify(
                    prettyHeaders(expectedHeaders),
                    prettyHeaders(receivedHeaders),
                    'expected headers',
                    'received headers',
                    this.expand ?? false,
                ),
            ),
    };
}

export interface ResponseMatchers {
    toSuccessfullyReturn(value: BodyInit | unknown): Promise<void>;

    toBeCached(): void;

    toBeCacheMiss(): void;

    toBeNotCacheable(): void;

    withHeaders(value: HeadersInit): void;
}

export const responseMatchers: MatchersFor<ResponseMatchers> = {
    toSuccessfullyReturn,
    toBeCached,
    toBeCacheMiss,
    toBeNotCacheable,
    withHeaders,
};
