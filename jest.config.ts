import type { InitialOptionsTsJest } from 'ts-jest';

const options: InitialOptionsTsJest = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    globals: {
        'ts-jest': {
            useESM: true,
        },
    },
    extensionsToTreatAsEsm: ['.ts'],
    injectGlobals: false,
};

export default options;
