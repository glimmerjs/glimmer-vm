import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import { join } from 'node:path';

import { $ } from 'execa';
import * as prettier from 'prettier';
import { describe, expect, it } from 'vitest';

const monorepoRoot = join(import.meta.dirname, '../../../../');
const require = createRequire(import.meta.url);

/**
 * See: https://github.com/glimmerjs/glimmer-vm/issues/1688
 *
 * Requires the root package.json#pnpm#overrides point at our internal
 * copy of @glimmer/syntax, or else prettier brings its own already published
 * copy of @glimmer/syntax
 */
describe('Prettier', () => {
  it(`SANITY: we've symlinked to the in-repo copy of @glimmer/syntax`, () => {
    let workspacePath = require.resolve('@glimmer/syntax');
    let prettierPath = require.resolve('prettier');
    let prettierGlimmer = require.resolve('@glimmer/syntax', { paths: [prettierPath] });

    expect(prettierGlimmer).toBe(workspacePath);
  });

  it('Underlynig preprocess API works', async () => {
    let result = (await import('@glimmer/syntax')).preprocess('<h1></h1>');

    expect(result, `It can be await import()'d, and doesn't error`).toBeTruthy();
  });

  it('Prettier can call preprocess', async () => {
    let result = await prettier.format(`     <div>\n</div>`, { parser: 'glimmer' });

    expect(result).toMatchInlineSnapshot(`
      "<div>
      </div>"
    `);
  });

  /**
   * This is important because we don't test the code we ship to npm
   * (the code we ship to npm goes through a build process, and we opted
   *  to not do that for in-repo dev ergonomics)
   *
   *  Process:
   *  1. build @glimmer/syntax (and dependencies)
   *  2. creat a tmp folder
   *  3. create a project in that tmp folder
   *  4. pack and add the tarballs to the project
   *  5. See if a basic import and call to pre-process works
   */
  it('Uses the real build, and not our monorepo infra', async () => {
    /**
     * pnpm packs tgz's with the name format ${hyphenated-package-name}-${version}.tgz
     */
    async function versionOf(name) {
      let manifestPath = join(monorepoRoot, 'packages', name, 'package.json');
      let manifestString = await readFile(manifestPath);
      return JSON.parse(manifestString.toString()).version;
    }

    let tarballs = {
      syntax: `glimmer-syntax-${await versionOf('@glimmer/syntax')}`,
      util: `glimmer-util-${await versionOf('@glimmer/util')}`,
      wireFormat: `glimmer-wire-format-${await versionOf('@glimmer/wire-format')}`,
    };

    let file = `console.log((await import('@glimmer/syntax')).preprocess('<h1></h1>'));`;
    let manifest = JSON.stringify({
      name: 'real-test',
      type: 'module',
      private: true,
      devDependencies: {
        '@glimmer/syntax': `file://./${tarballs.syntax}`,
        '@glimmer/util': `file://./${tarballs.util}`,
        '@glimmer/wire-format': `file://./${tarballs.wireFormat}`,
      },
      pnpm: {
        overrides: {
          '@glimmer/syntax': `file://./${tarballs.syntax}.tgz`,
          '@glimmer/util': `file://./${tarballs.util}.tgz`,
          '@glimmer/wire-format': `file://./${tarballs.wireFormat}.tgz`,
        },
      },
    });

    async function newTmpDir() {
      const tmpDir = await mkdtemp(
        join(os.tmpdir(), `glimmer-node-integration-testing-${Date.now()}-`)
      );

      return tmpDir;
    }

    function inDir(dir: string, cmd: string, options = {}) {
      return $({ cwd: dir, preferLocal: true, shell: true, ...options })(cmd);
    }
    function inRoot(cmd: string) {
      return inDir(monorepoRoot, cmd);
    }

    function inTmp(cmd: string, options = {}) {
      return inDir(tmp, cmd, options);
    }

    //////////
    // 1 build
    //   When turbo is set up with "dependsOn": "["^prepack"], we see these packages
    //   - @glimmer/syntax
    //   - @glimmer/util
    //   - @glimmer/wire-format
    //
    //   So these 3 packages need to be packed and installed
    await inRoot(`pnpm turbo --filter "@glimmer/syntax" prepack`);

    //////////
    // 2 create a space that doesn't mess up the repo
    let tmp = await newTmpDir();

    // eslint-disable-next-line no-console
    console.debug(`Project can be inspected at ${tmp}`);

    //////////
    // 3 create a project that represents real consumer usage
    await writeFile(join(tmp, 'package.json'), manifest);
    await writeFile(join(tmp, 'index.js'), file);

    //////////
    // 4 install the tarballs using stable names so we don't have to
    //   dynamically build the package.json
    let packToTemp = `pnpm pack --pack-destination ${tmp}`;
    await inDir(join(monorepoRoot, 'packages/@glimmer/syntax'), packToTemp);
    await inDir(join(monorepoRoot, 'packages/@glimmer/util'), packToTemp);
    await inDir(join(monorepoRoot, 'packages/@glimmer/wire-format'), packToTemp);
    await inTmp(`pnpm install`);

    //////////
    // 5 does it work?
    //
    // NOTE: dev isn't allowed because it requires that @glimmer/env be compiled away
    //       let dev = await inTmp(`node --conditions="development" index.js`);
    //
    let prod = await inTmp(`node --conditions="production" index.js`);
    // should also be prod, as dev won't work without a build system
    let defaultConditions = await inTmp(`node index.js`);

    expect(prod.stdout).toMatchInlineSnapshot();
    // expect(dev.stdout).toMatchInlineSnapshot();
    expect(defaultConditions.stdout).toMatchInlineSnapshot();
  });
});
