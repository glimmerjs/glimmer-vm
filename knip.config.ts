import type { KnipConfig } from 'knip';

export default {
  workspaces: {
    '.': {
      ignore: ['testem-browserstack.js'],
    },
    'packages/*': { entry: ['index.ts', 'rollup.config.mjs', 'test/**/*.ts'] },
    'packages/*/*/test': { entry: ['**/*-test.ts'] },
    'packages/@glimmer-workspace/build': {
      entry: ['index.js', 'index.d.ts'],
    },
    'packages/@glimmer-workspace/eslint-plugin': {
      eslint: {
        config: ['lib/recommended.cjs'],
      },
      entry: ['lib/index.cjs'],
      ignoreDependencies: ['eslint-import-resolver-typescript'],
    },
    'packages/@glimmer-workspace/integration-tests': {
      entry: ['test/**/*-test.ts'],
    },
    'benchmark/benchmarks/krausest': {
      entry: ['browser.js'],
    },
    bin: {
      entry: ['*.{mjs,mts}'],
    },
  },
} satisfies KnipConfig;
