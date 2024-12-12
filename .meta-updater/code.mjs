import { readFileSync, writeFileSync } from 'node:fs';

import { createFormat } from '@pnpm/meta-updater';
import {} from '@pnpm/workspace.find-packages';
import { equals } from 'ramda';
import { $ } from 'zx';

/**
 * @type {import('@pnpm/meta-updater').FormatPlugin<string>}
 */
export const code = createFormat({
  read({ resolvedPath }) {
    return readFileSync(resolvedPath, { encoding: 'utf-8' });
  },
  update(actual, updater, options) {
    return updater(actual, options);
  },
  equal(expected, actual) {
    return equals(actual, expected);
  },
  async write(expected, options) {
    writeFileSync(options.resolvedPath, expected, { encoding: 'utf-8' });
    await $({ verbose: true })`eslint --fix ${options.resolvedPath}`;
  },
});
