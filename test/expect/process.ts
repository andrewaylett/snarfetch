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

import { ChildProcess } from 'child_process';

import { ExpectationResult, MatcherState, MatchersFor } from 'extend-expect';

async function toSpawnSuccessfully(
    this: MatcherState,
    received: unknown,
    expected: unknown,
): Promise<ExpectationResult> {
    const options = {
        comment: 'Check that a process succeeded',
        isNot: this.isNot,
        promise: this.promise,
    };
    this.utils.ensureNoExpected(expected, 'isAFile', options);

    const matcherHint = this.utils.matcherHint(
        'toSpawnSuccessfully',
        undefined,
        undefined,
        options,
    );

    if (!(received instanceof ChildProcess)) {
        return {
            pass: false,
            message: () =>
                this.utils.matcherErrorMessage(
                    matcherHint,
                    `${this.utils.RECEIVED_COLOR(
                        'received',
                    )} value must be a ChildProcess`,
                    this.utils.printWithType(
                        'Received',
                        received,
                        this.utils.printReceived,
                    ),
                ),
        };
    }

    return new Promise((resolve) => {
        received.on('exit', (code, signal) => {
            const pass = code === 0;
            const status = pass ? 'success' : 'failure';
            resolve({
                pass,
                message: () =>
                    this.utils.matcherErrorMessage(
                        matcherHint,
                        `${this.utils.RECEIVED_COLOR(
                            'received',
                        )} value indicates process ${status}`,
                        `Exit code: ${code}, signal: ${signal}`,
                    ),
            });
        });
    });
}

export interface ProcessMatchers {
    toSpawnSuccessfully(): Promise<void>;
}

export const processMatchers: MatchersFor<ProcessMatchers> = {
    toSpawnSuccessfully,
};
