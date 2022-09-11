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

/** @type {import('jest').Config} */
const options = {
    testEnvironment: 'node',
    injectGlobals: false,
    moduleNameMapper: {
        '^#(.*)$': '<rootDir>/dist/$1.js',
    },
};

// noinspection JSUnusedGlobalSymbols
export default options;
