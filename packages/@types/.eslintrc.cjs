/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: false,
  overrides: [
    {
      files: ['*/index.{js,cjs,mjs,ts,d.ts}', '*/{lib,test}/**/*.{js,cjs,mjs,ts,d.ts}'],
      plugins: ['@glimmer-workspace'],
      extends: ['plugin:@glimmer-workspace/recommended'],
    },
  ],
};
