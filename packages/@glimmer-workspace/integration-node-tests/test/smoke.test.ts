import { join } from 'node:path';

import { WORKSPACE_ROOT } from '@glimmer-workspace/repo-metadata';
import { $ } from 'execa';
import { describe, it } from 'vitest';

const NODE_SMOKE_DIR = join(WORKSPACE_ROOT, './smoke-tests/node');

function inNodeSmoke(cmd: string, options = {}) {
  return $({ cwd: NODE_SMOKE_DIR, preferLocal: true, shell: true, ...options })(cmd);
}

describe('Smake Tests', () => {
  /**
   * This is important because we don't test the code we ship to npm
   * (the code we ship to npm goes through a build process, and we opted
   *  to not do that for in-repo dev ergonomics)
   */
  it('Uses the real build, and not our monorepo infra', { timeout: 20_000 }, async () => {
    await inNodeSmoke(
      `node --disable-warning=ExperimentalWarning --experimental-strip-types ./setup.ts`
    );
    await inNodeSmoke(`pnpm run test:node`);
  });
});
