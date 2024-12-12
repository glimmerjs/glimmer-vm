// @ts-check

const { resolve } = require('node:path');
const glob = require('fast-glob');

const eslintFiles = glob.sync('**/.eslintrc.cjs', {
  cwd: __dirname,
  ignore: ['**/node_modules/**', '**/dist/**', '**/ts-dist/**'],
});

const rollupFiles = glob.sync('**/rollup.config.mjs', {
  cwd: __dirname,
  ignore: ['**/node_modules/**', '**/dist/**', '**/ts-dist/**'],
});

/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  reportUnusedDisableDirectives: true,
  extends: [],
  ignorePatterns: [
    'dist',
    'ts-dist',
    'node_modules',
    'tmp',
    '**/node_modules',
    '**/dist',
    '**/fixtures',
  ],

  rules: {},
  overrides: [
    {
      files: ['./knip.config.ts', './vite.config.mts', './.meta-updater/*.mjs'],
      extends: ['plugin:@glimmer-workspace/recommended'],
    },
    {
      files: [...eslintFiles, ...rollupFiles],
      extends: ['plugin:@glimmer-workspace/recommended'],
      parserOptions: {
        projectService: {
          allowDefaultProject: [...eslintFiles, ...rollupFiles],
          defaultProject: resolve(
            __dirname,
            'packages/@glimmer-workspace/eslint-plugin/lib/tsconfig.plugin.json'
          ),
        },
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/unbound-method': 'off',
        'n/no-unpublished-import': 'off',
      },
    },
    {
      files: [
        '.release-plan.json',
        'turbo.json',
        '.prettierrc.json',
        'package.json',
        'tsconfig.json',
      ],
      parser: 'jsonc-eslint-parser',
      extends: ['plugin:jsonc/recommended-with-json', 'plugin:jsonc/prettier'],
      rules: {},
    },
    {
      files: ['.vscode/*.json', 'tsconfig.*.json'],
      parser: 'jsonc-eslint-parser',
      extends: ['plugin:jsonc/recommended-with-jsonc', 'plugin:jsonc/prettier'],
      rules: {},
    },
    {
      files: ['./package.json', '**/package.json'],
      parser: 'jsonc-eslint-parser',
      extends: ['plugin:jsonc/recommended-with-json', 'plugin:jsonc/prettier'],
      rules: {
        // Enforce order in the scripts object
        // https://ota-meshi.github.io/eslint-plugin-jsonc/rules/sort-keys.html
        'jsonc/sort-keys': [
          'error',
          {
            pathPattern: '^$',
            order: [
              'name',
              'version',
              'license',
              'description',
              'repository',
              'author',
              'type',
              'main',
              'types',
              'module',
              'exports',
              'publishConfig',
              'files',
              'scripts',
              'dependencies',
              'peerDependencies',
              'devDependencies',
              'release-it',
              'changelog',
              'engines',
              'volta',
            ],
          },
          {
            pathPattern:
              'scripts|dependencies|devDependencies|peerDependencies|optionalDependencies|pnpm|overrides|peerDependencyRules|patchedDependencies|dependenciesMeta',
            order: { type: 'asc' },
          },
          // ...
        ],
      },
    },

    {
      // these packages need to be fixed to avoid these warnings, but in the
      // meantime we should not regress the other packages
      files: [
        // this specific test imports from @glimmer/runtime (causing a cyclic
        // dependency), it should either be refactored to use the interfaces
        // directly (instead of the impls) or moved into @glimmer/runtime
        'packages/@glimmer/reference/test/template-test.ts',
      ],
      rules: {
        'n/no-extraneous-import': 'warn',
      },
    },

    // QUnit is a weird package, and there are some issues open about fixing it
    // - https://github.com/qunitjs/qunit/issues/1729
    // - https://github.com/qunitjs/qunit/issues/1727
    // - https://github.com/qunitjs/qunit/issues/1724
    {
      files: ['**/*-test.ts', '**/{test,integration-tests}/**/*.ts'],
      rules: {
        '@typescript-eslint/unbound-method': 'off',
      },
    },
  ],
};
