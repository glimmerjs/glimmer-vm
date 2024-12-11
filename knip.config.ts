import type { KnipConfig } from 'knip';

export default {
  workspaces: {
    'packages/*': { entry: ['index.ts', 'rollup.config.mjs', 'test/**/*.ts'] },
  },
} satisfies KnipConfig;
