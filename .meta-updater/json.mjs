import { basename } from 'node:path';

import { createFormat } from '@pnpm/meta-updater';
import {} from '@pnpm/workspace.find-packages';
import { loadJsonFile } from 'load-json-file';
import { equals } from 'ramda';
import { writeJsonFile } from 'write-json-file';

/**
 * @import { Workspace } from './requirements.mjs';
 * @import { FormatPlugin } from '@pnpm/meta-updater';
 */

/**
 * @param {Workspace} workspace
 * @returns {FormatPlugin<object>}
 */
export const json = (workspace) =>
  createFormat({
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
      await workspace.update(options.resolvedPath, expected, async (content, path) => {
        if (content && basename(path) === 'package.json') {
          await options._writeProjectManifest(content);
        } else {
          await writeJsonFile(path, content, { detectIndent: true });
        }
      });
    },
  });
