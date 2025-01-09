/* eslint-disable no-console */
import { readFileSync, writeFileSync } from 'node:fs';

import { createFormat } from '@pnpm/meta-updater';
import { equals } from 'ramda';
import { $, chalk } from 'zx';

/**
 * @import { Workspace } from './requirements.mjs';
 * @import { FormatPlugin } from '@pnpm/meta-updater';
 */

/**
 * @param {Workspace} workspace
 * @returns {FormatPlugin<string>}
 */
export const code = (workspace) =>
  createFormat({
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
      await workspace.update(options.resolvedPath, expected, writeFileSync);
    },
  });
