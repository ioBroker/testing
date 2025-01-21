import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default [
    {
        ignores: ['**/build/', '**/node_modules/'],
    },
    ...compat.extends('plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'),
    {
        plugins: {},

        files: ['src/**/*.ts'],
        linterOptions: {
            reportUnusedDisableDirectives: true,
        },

        rules: {
            '@typescript-eslint/no-unsafe-declaration-merging': 'off',
            '@typescript-eslint/no-parameter-properties': 'off',
            '@typescript-eslint/no-explicit-any': 'off',

            '@typescript-eslint/no-use-before-define': [
                'error',
                {
                    functions: false,
                    typedefs: false,
                    classes: false,
                },
            ],

            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    ignoreRestSiblings: true,
                    argsIgnorePattern: '^_',
                },
            ],

            '@typescript-eslint/explicit-function-return-type': [
                'warn',
                {
                    allowExpressions: true,
                    allowTypedFunctionExpressions: true,
                },
            ],

            '@typescript-eslint/no-object-literal-type-assertion': 'off',
            '@typescript-eslint/interface-name-prefix': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',

            '@typescript-eslint/no-inferrable-types': [
                'error',
                {
                    ignoreParameters: true,
                    ignoreProperties: true,
                },
            ],
        },
    },
    {
        files: ['**/*.test.ts'],

        rules: {
            '@typescript-eslint/explicit-function-return-type': 'off',
        },
    },
    {
        files: ['**/*.js'],
        rules: {
            // Disable all TypeScript-specific rules for JavaScript files
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-parameter-properties': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-use-before-define': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-object-literal-type-assertion': 'off',
            '@typescript-eslint/interface-name-prefix': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-inferrable-types': 'off',
        },
    },
];
