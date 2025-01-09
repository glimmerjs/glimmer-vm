/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: false,
  overrides: [
    {
      files: ['**/*.{js,ts,mts}'],
      env: {
        browser: true,
      },
      parserOptions: {
        projectService: true,
      },
      extends: ['plugin:@glimmer-workspace/recommended'],
    },
  ],
};
