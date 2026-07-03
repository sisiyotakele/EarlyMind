import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: '.',
    testMatch: ['**/*.test.ts'],
    collectCoverageFrom: ['src/**/*.ts', '!src/index.ts', '!src/db/seeds/**'],
    coverageThreshold: {
        global: {
            // SRS §10.1: >=70% coverage for feature-extraction and scoring logic
            lines: 70,
            functions: 70,
            branches: 70,
        },
    },
};

export default config;
