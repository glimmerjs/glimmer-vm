// @ts-check

const recommended = require('./recommended.cjs');

/** @type {import("eslint").ESLint.Plugin} */
module.exports = {
  meta: {
    name: '@glimmer-workspace/eslint-plugin',
    version: '1.0.0',
  },
  configs: {
    recommended,
  },
};
