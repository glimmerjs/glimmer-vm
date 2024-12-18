const { resolve } = require('path');

// @ts-check
/** @type {import("eslint").ESLint.ConfigData} */
module.exports = {
  settings: {
    'import-x/parsers': {
      '@typescript-eslint/parser': ['.js', '.cjs', '.mjs', '.mts', '.ts', '.d.ts'],
    },
    'import-x/resolver': {
      typescript: {
        alwaysTryTypes: true,
      },
    },
    node: {
      allowModules: ['@glimmer/debug', '@glimmer/local-debug-flags'],
      tryExtensions: ['.cjs', '.js', '.ts', '.d.ts', '.json'],
    },
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    projectService: {
      allowDefaultProject: ['rollup.config.mjs', '.eslintrc.cjs'],
      defaultProject: resolve(__dirname, './tsconfig.plugin.json'),
    },
  },
  env: {
    es6: true,
  },

  plugins: [
    '@typescript-eslint',
    'prettier',
    'qunit',
    'simple-import-sort',
    'unused-imports',
    'import-x',
    'n',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:n/recommended',
    'plugin:import-x/recommended',
    'plugin:import-x/typescript',
    'plugin:qunit/recommended',
    'plugin:regexp/recommended',
    'prettier',
  ],
  rules: {
    'prefer-arrow-callback': 'error',
    'no-restricted-imports': 'off',
    'no-inner-declarations': 'off',
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        patterns: [
          { group: ['**/generated/**'], message: "Don't import directly from generated files" },
          {
            group: ['console', 'node:console'],
            message: "Don't import directly from 'console'",
          },
        ],
      },
    ],
    '@typescript-eslint/no-redundant-type-constituents': 'off',
    '@typescript-eslint/no-deprecated': 'error',
    'no-console': 'error',
    'no-debugger': 'error',
    'no-loop-func': 'error',
    'prefer-const': 'off',
    'no-fallthrough': 'off',
    'import-x/no-relative-packages': 'error',
    'import-x/default': 'off',
    'import-x/first': 'error',
    'import-x/newline-after-import': 'error',
    'import-x/consistent-type-specifier-style': ['error', 'prefer-top-level'],
    'import-x/no-duplicates': 'error',
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
      'error',
      { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
    ],
    'n/no-unpublished-require': 'off',

    'qunit/require-expect': ['error', 'never-except-zero'],
    // we're using assert.step instead of this sort of thing
    'qunit/no-conditional-assertions': 'off',
    'regexp/require-unicode-regexp': 'error',
    'regexp/unicode-escape': 'error',
    'regexp/sort-character-class-elements': 'error',
    'regexp/prefer-result-array-groups': 'error',
    'regexp/prefer-named-replacement': 'error',
    'regexp/prefer-named-backreference': 'error',
    'regexp/prefer-lookaround': 'error',
    'regexp/use-ignore-case': 'error',
    'regexp/prefer-regexp-test': 'error',
    'regexp/prefer-regexp-exec': 'error',
    'regexp/prefer-quantifier': 'error',
    'require-unicode-regexp': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        fixStyle: 'separate-type-imports',
      },
    ],
    '@typescript-eslint/consistent-type-exports': [
      'error',
      {
        fixMixedExportsWithInlineTypeSpecifier: true,
      },
    ],
    '@typescript-eslint/no-import-type-side-effects': 'error',
    '@typescript-eslint/naming-convention': [
      'error',
      {
        format: ['camelCase', 'PascalCase'],
        leadingUnderscore: 'allow',
        selector: ['parameter'],
      },
      {
        format: null,
        modifiers: ['const'],
        selector: 'variable',
      },
      {
        format: ['PascalCase'],
        leadingUnderscore: 'allow',
        selector: ['typeLike'],
      },
      {
        format: ['PascalCase', 'UPPER_CASE'],
        selector: ['typeAlias'],
      },
    ],
    'require-await': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-inferrable-types': 'error',
    '@typescript-eslint/no-require-imports': 'error',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off',

    'n/no-missing-import': 'off',
    'import-x/no-unresolved': 'error',
    'import-x/no-extraneous-dependencies': ['error', { includeTypes: true }],
    'sort-imports': 'off',
    'simple-import-sort/imports': [
      'error',
      {
        groups: [
          // == Side effect imports. ==
          ['^\\u0000'],

          // == from node:* ==
          [
            //
            '^node:.+\\u0000$',
            '^node:',
          ],

          // == From (optionally scoped) packages
          [
            // import type
            '^@?\\w.+\\u0000$',
            '^@?\\w',
          ],

          // == from absolute imports ==
          //
          // (Absolute imports and other imports such as Vue-style `@/foo`. Anything not matched
          // in another group.)
          [
            // import type
            '^.+\\u0000$',
            '^',
          ],

          // == Relative imports ==.
          [
            // import type
            '^\\..+\\u0000$',
            '^\\.',
          ],
        ],
      },
    ],
    'simple-import-sort/exports': 'error',
    'no-unused-private-class-members': 'error',

    'n/no-unsupported-features/es-syntax': 'off',
    'n/no-unsupported-features/node-builtins': 'off',
  },
};
