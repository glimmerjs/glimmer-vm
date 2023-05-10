const { resolve } = require('path');

const tsconfig = resolve(__dirname, 'tsconfig.json');

// node files
/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: false,

  overrides: [
    {
      files: ['*.mts'],
      env: {
        es6: true,
        node: true,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        project: [tsconfig],
      },
      extends: ['plugin:@typescript-eslint/recommended-requiring-type-checking'],

      rules: {
        'no-console': 'off',
      },
    },
  ],
};
