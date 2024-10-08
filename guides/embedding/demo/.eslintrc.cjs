const { resolve } = require('path');

const libTsconfig = resolve(__dirname, 'tsconfig.json');

module.exports = {
  root: false,
  plugins: ['@glimmer-workspace'],
  parserOptions: {
    extraFileExtensions: ['.gjs'],
    project: [libTsconfig],
  },
  extends: ['plugin:@glimmer-workspace/recommended'],
};
