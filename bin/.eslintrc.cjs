// node files
module.exports = {
  root: false,
  env: {
    es6: true,
  },
  overrides: [
    {
      files: ['*.{ts,mts,js,mjs,d.ts}'],
      extends: ['plugin:@glimmer-workspace/recommended'],

      rules: {
        'dot-notation': 'off',
        'no-console': 'off',
        'no-continue': 'off',
        'no-undef': 'off',
        'n/no-unsupported-features/es-syntax': [
          'error',
          {
            ignores: [],
            version: '>=16.0.0',
          },
        ],
        'n/shebang': 'off',
      },
    },
  ],
};
