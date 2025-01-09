const { existsSync, readFileSync } = require('fs');
const { resolve, relative, dirname } = require('path');

const glob = require('fast-glob');

const testDirs = glob.sync(['*/test'], {
  cwd: __dirname,
  absolute: true,
  onlyDirectories: true,
  ignore: ['**/node_modules/**'],
});

/**
 * @type {Record<string, Record<string, string[] | undefined>>}
 */
const RESTRICTIONS = {};

for (const dir of testDirs) {
  const pkgRoot = dirname(dir);

  if (!existsSync(resolve(dir, 'package.json'))) {
    // don't create rules if the tests dir doesn't have a package.json
    continue;
  }

  const packageName = JSON.parse(readFileSync(resolve(pkgRoot, 'package.json'), 'utf8')).name;

  const files = glob.sync(['**/*.{js,ts,d.ts}'], {
    cwd: dir,
    absolute: true,
    onlyFiles: true,
    ignore: ['**/node_modules/**'],
  });

  for (const file of files) {
    const relativeFile = `./${relative(__dirname, file)}`;
    const relativeToLib = relative(dirname(file), resolve(dirname(dir), 'lib'));

    const pkg = (RESTRICTIONS[packageName] ??= {});

    if (pkg[relativeToLib]) {
      pkg[relativeToLib].push(relativeFile);
    } else {
      pkg[relativeToLib] = [relativeFile];
    }
  }
}

/**
 * @type {import("eslint").Linter.Config["overrides"]}
 */
const overrides = Object.entries(RESTRICTIONS).flatMap(([pkgName, overrides]) =>
  Object.entries(overrides).map(([lib, files]) => ({
    files,
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: lib,
              message: `Import from ${pkgName} instead`,
            },
          ],
        },
      ],
    },
  }))
);

// console.dir({ overrides }, { depth: null });

/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: false,
  plugins: ['@glimmer-workspace'],
  parserOptions: {
    projectService: true,
    tsconfigRootDir: __dirname,
  },
  overrides: [
    {
      files: ['*/index.{js,cjs,mjs,ts,d.ts}', '*/lib/**/*.{js,cjs,mjs,ts,d.ts}'],
      excludedFiles: ['node_modules', '*/node_modules'],
      extends: ['plugin:@glimmer-workspace/recommended'],
    },
    {
      files: ['*/lib/**/*.cjs'],
      env: {
        node: true,
      },
      excludedFiles: ['node_modules', '*/node_modules'],

      plugins: ['@glimmer-workspace'],
      extends: ['plugin:@glimmer-workspace/recommended'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/unbound-method': 'off',
        'no-undef': 'off',
      },
    },
    {
      files: ['integration-tests/{lib,test}/**/*.ts'],
      extends: ['plugin:@glimmer-workspace/recommended'],
      rules: {
        // off for now
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    // QUnit is a weird package, and there are some issues open about fixing it
    // - https://github.com/qunitjs/qunit/issues/1729
    // - https://github.com/qunitjs/qunit/issues/1727
    // - https://github.com/qunitjs/qunit/issues/1724
    {
      files: ['*/test/**/*.{js,ts,d.ts}'],
      plugins: ['@glimmer-workspace'],
      extends: ['plugin:@glimmer-workspace/recommended'],
      rules: {
        '@typescript-eslint/unbound-method': 'off',
        // off for now
        '@typescript-eslint/no-explicit-any': 'off',
        'import-x/no-relative-packages': 'error',
        'no-restricted-paths': 'off',
      },
    },
    ...overrides,
  ],
};
