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

import { MatchersFor, MatcherState, ExpectationResult } from 'extend-expect';
import { CacheRules } from '../../src/cacheRules';
import { Instant } from '../../src/temporal';

function validAt(
    this: MatcherState,
    cacheRule: unknown,
    instant: unknown,
): ExpectationResult {
    const options = {
        comment: 'Check that a cache is valid',
        isNot: this.isNot,
        promise: this.promise,
    };

    const matcherHint = this.utils.matcherHint(
        'validAt',
        'cache rule',
        'instant',
        options,
    );

    if (!(cacheRule instanceof CacheRules)) {
        return {
            pass: false,
            message: () =>
                this.utils.matcherErrorMessage(
                    matcherHint,
                    `${this.utils.RECEIVED_COLOR(
                        'received',
                    )} value must be a CacheRules instance`,
                    this.utils.printWithType(
                        'Cache rule',
                        cacheRule,
                        this.utils.printReceived,
                    ),
                ),
        };
    }
    if (!(instant instanceof Instant)) {
        return {
            pass: false,
            message: () =>
                this.utils.matcherErrorMessage(
                    matcherHint,
                    `${this.utils.EXPECTED_COLOR(
                        'expected',
                    )} value must be a Instant instance`,
                    this.utils.printWithType(
                        'Instant',
                        instant,
                        this.utils.printExpected,
                    ),
                ),
        };
    }

    const pass = cacheRule.validAt(instant);
    return {
        pass,
        message: () =>
            this.utils.matcherErrorMessage(
                matcherHint,
                `${this.utils.RECEIVED_COLOR('cache rule')} value was ${
                    pass ? '' : 'not '
                }valid at ${this.utils.EXPECTED_COLOR('instant')}`,
                `${this.utils.printReceived(
                    cacheRule,
                )}\n${this.utils.printExpected(instant)}`,
            ),
    };
}

export interface CacheMatchers {
    validAt(i: Instant): void;
}

export const cacheMatchers: MatchersFor<CacheMatchers> = {
    validAt,
};
