const { resolve } = require('path');

const tsconfig = resolve(__dirname, 'tsconfig.json');

/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: false,
  overrides: [
    {
      files: ['*.d.ts'],
      excludedFiles: ['*/node_modules'],
      parserOptions: {
        ecmaVersion: 'latest',
        project: [tsconfig],
      },
      extends: ['plugin:@typescript-eslint/recommended-requiring-type-checking'],
      rules: {
        '@typescript-eslint/consistent-type-imports': [
          'error',
          {
            fixStyle: 'inline-type-imports',
          },
        ],
        '@typescript-eslint/consistent-type-exports': [
          'error',
          {
            fixMixedExportsWithInlineTypeSpecifier: true,
          },
        ],
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
        'prefer-const': 'off',
        'consistent-return': 'off',
        'consistent-this': 'off',
        'constructor-super': 'off',
        'default-case': 'off',
        'dot-notation': 'off',
        'func-name-matching': 'off',
        'func-style': 'off',
        'guard-for-in': 'off',
        'line-comment-position': 'off',
        'n/no-missing-import': 'off',
        'n/no-unsupported-features/es-syntax': 'off',
        'n/no-unsupported-features/node-builtins': 'off',
        'new-cap': 'off',
        'no-bitwise': 'off',
        'no-case-declarations': 'off',
        'no-constant-condition': 'off',
        'no-continue': 'off',
        'no-debugger': 'error',
        'no-duplicate-imports': 'off',
        'no-else-return': 'off',
        'no-empty': 'off',
        'no-fallthrough': 'off',
        'no-inline-comments': 'off',
        'no-invalid-this': 'off',
        'no-labels': 'off',
        'no-lone-blocks': 'off',
        'no-lonely-if': 'off',
        'no-multi-assign': 'off',
        'no-negated-condition': 'off',
        'no-new': 'off',
        'no-script-url': 'off',
        'no-shadow': 'off',
        'no-throw-literal': 'off',
        'no-undef-init': 'off',
        'no-unneeded-ternary': 'off',
        'no-unsafe-finally': 'off',
        'no-unused-expressions': 'error',
        'no-useless-call': 'off',
        'no-useless-concat': 'off',
        'no-useless-constructor': 'off',
        'no-useless-escape': 'off',
        'no-useless-return': 'off',
        'no-warning-comments': 'off',
        'object-shorthand': 'off',
        'operator-assignment': 'off',
        'prefer-rest-params': 'off',
        'prefer-spread': 'off',
        'spaced-comment': 'off',
      },
    },
  ],
};
