import { basename } from 'node:path';

import { createFormat } from '@pnpm/meta-updater';
import {} from '@pnpm/workspace.find-packages';
import { loadJsonFile } from 'load-json-file';
import { equals } from 'ramda';
import { writeJsonFile } from 'write-json-file';
import { $ } from 'zx';

/**
 * @type {import('@pnpm/meta-updater').FormatPlugin<object>}
 */
export const json = createFormat({
  read({ resolvedPath }) {
    return loadJsonFile(resolvedPath);
  },
  update(actual, updater, options) {
    return updater(actual, options);
  },
  equal(expected, actual) {
    return equals(actual, expected);
  },
  async write(expected, options) {
    if (expected && basename(options.resolvedPath) === 'package.json') {
      await options._writeProjectManifest(
        /** @type {import('@pnpm/types').ProjectManifest} */ (expected)
      );
    } else {
      await writeJsonFile(options.resolvedPath, expected, { detectIndent: true });
    }

    await $({ verbose: true })`eslint --fix ${options.resolvedPath}`;
  },
});
