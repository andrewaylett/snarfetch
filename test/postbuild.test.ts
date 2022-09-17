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

import { readFileSync } from 'node:fs';
import * as fs from 'node:fs';
import { promisify } from 'node:util';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';

import semver from 'semver';
import { it } from '@jest/globals';

import { expect } from './expect/index.js';

type StringOrStringRecord = string | Record<string, string>;
type NestedStringRecords =
    | number
    | boolean
    | string
    | { [s: string]: NestedStringRecords };

type PackageFile = Partial<
    Record<string, NestedStringRecords> & {
        source: string;
        main: string;
        types: string;
        bin: StringOrStringRecord;
        exports: Record<string, string>;
        imports: Record<string, StringOrStringRecord>;
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
        peerDependencies: Record<string, string>;
    }
>;

const PACKAGE_JSON: PackageFile = JSON.parse(
    readFileSync('./package.json').toString(),
);

const mkdtemp: typeof fs.mkdtemp.__promisify__ = promisify(fs.mkdtemp);
const writeFile: typeof fs.writeFile.__promisify__ = promisify(fs.writeFile);

const POST_BUILD_TESTS = 'POST_BUILD_TESTS';
const itNonRecursive = process.env[POST_BUILD_TESTS] ? it.skip : it;

itNonRecursive(
    'Stick versions to minimum',
    async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), 'downgrade-build-'));
        type VersionSpec = { [s: string]: string } | undefined;
        const strip = <T extends VersionSpec>(deps: T): T => {
            if (!deps) {
                return deps;
            }
            return Object.fromEntries(
                Object.entries(deps).map(
                    ([k, v]: [string, string]): [string, string] => {
                        const min = semver.minVersion(v);
                        if (!min) {
                            throw new Error(`No semver minimum for ${v}`);
                        }
                        return [k, min.format()];
                    },
                ),
            ) as T;
        };
        const dependencies = strip(PACKAGE_JSON.dependencies);
        const devDependencies = strip(PACKAGE_JSON.devDependencies);
        const peerDependencies = strip(PACKAGE_JSON.peerDependencies);
        if (peerDependencies && devDependencies) {
            for (const [key, value] of Object.entries(peerDependencies)) {
                devDependencies[key] = value;
            }
        }
        const packageJson: PackageFile = {
            ...PACKAGE_JSON,
            dependencies,
            devDependencies,
            peerDependencies,
            overrides: {
                ...dependencies,
                ...devDependencies,
            },
        };
        await writeFile(
            path.join(dir, 'package.json'),
            JSON.stringify(packageJson),
        );
        console.log(`Working in: ${dir}`);

        await expect(
            spawn('npm', ['install'], { cwd: dir, stdio: 'inherit' }),
        ).toSpawnSuccessfully();
        await expect(
            spawn(
                'cp',
                [
                    '-r',
                    'src',
                    'test',
                    '.ed*',
                    '.es*',
                    'jest*',
                    'tsconfig*',
                    dir,
                ],
                {
                    stdio: 'inherit',
                    shell: true,
                },
            ),
        ).toSpawnSuccessfully();
        await expect(
            spawn('npm', ['run', 'build'], {
                cwd: dir,
                stdio: 'inherit',
                env: { ...process.env, [POST_BUILD_TESTS]: '1' },
            }),
        ).toSpawnSuccessfully();
    },
    1_000_000,
);
