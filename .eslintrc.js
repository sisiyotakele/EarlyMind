// Root ESLint config — extended per-package as needed
module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'prettier',
    ],
    rules: {
        // Enforce no unused variables (catches dead code early)
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        // Require explicit return types on exported functions for API-boundary clarity
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        // No console.log in production code (use structured logger)
        'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
    env: {
        node: true,
        es2022: true,
    },
    ignorePatterns: ['dist/', 'node_modules/', 'coverage/', '*.js.map'],
};
