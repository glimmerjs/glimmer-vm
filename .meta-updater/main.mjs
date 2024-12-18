// @ts-check
import { join, relative } from 'node:path';

import { findWorkspaceDir } from '@pnpm/find-workspace-dir';
import { createUpdateOptions } from '@pnpm/meta-updater';
import { equals } from 'ramda';

import { code } from './code.mjs';
import { json } from './json.mjs';
import { Workspace } from './requirements.mjs';

/**
 * @import {  ProjectManifest } from '@pnpm/types';
 */

const workspaceRoot = await findWorkspaceDir(process.cwd());

if (!workspaceRoot) {
  throw new Error('Could not find workspace root');
}

const workspace = Workspace.of(workspaceRoot);
const workspaceInfo = await workspace.packages();

if (!workspaceInfo) {
  throw new Error('Could not find workspace info');
}

const packages = workspaceInfo;

/**
 * @typedef {{compilerOptions?: { composite?: boolean; incremental?: boolean; types?: string[]; outDir?: string}; include?: string[]; references?: ({path: string})[]}} TsConfig
 */

/**
 * @param {string} workspaceDir
 */
export default function main(workspaceDir) {
  return createUpdateOptions({
    formats: {
      '.json': json(workspace),
      '#code': code(workspace),
    },
    files: {
      'rollup.config.mjs [#code]': (_, options) => {
        const req = workspace.project(options);

        // If the package needs to be built, generate a rollup config
        // that builds the package. This will be used by the `build`
        // script, which is set up below in `package.json`.
        if (req.needsBuild) {
          return (
            [
              `import { Package } from '@glimmer-workspace/build-support';`,
              `export default Package.config(import.meta);`,
            ].join('\n\n') + '\n'
          );
        }

        return null;
      },
      'package.json': (actual, options) => {
        if (!actual) {
          return actual;
        }

        const req = workspace.project(options);

        const pkg = /** @type {ProjectManifest & { exports?: string }} */ (actual);

        pkg.scripts ??= {};
        pkg.devDependencies ??= {};

        updateAll(pkg.devDependencies, { '@types/qunit': 'catalog:' }, req.needsTestTypes);
        updateAll(pkg.devDependencies, { '@types/node': 'catalog:' }, req.needsNodeTypes);

        // Don't use catalog: dependencies in the benchmark package
        // until the base branch has been updated
        if (!req.isBench) {
          updateAll(
            pkg.devDependencies,
            { eslint: 'catalog:', typescript: 'catalog:' },
            req.needsTsconfig || req.isRoot
          );
        }

        if (!req.isRoot) {
          updateAll(pkg.scripts, { 'test:lint': 'eslint .' }, req.hasTests);
        }

        // If the package needs to be built, add `@glimmer-workspace/build-support`
        // and `rollup` as devDependencies.
        updateAll(
          pkg.devDependencies,
          {
            '@glimmer-workspace/build-support': 'workspace:*',
            rollup: 'catalog:',
          },
          req.needsBuild
        );

        // Leave the build script in the root package alone
        if (!req.isRoot) {
          // If the package needs to be built, add a `build` script that
          // builds the package using rollup.
          updateAll(pkg.scripts, { build: 'rollup -c rollup.config.mjs' }, req.needsBuild);

          // If the package is published, add `publint` as a devDependency
          // and a `test:publint` script that runs `publint`.
          updateAll(pkg.scripts, { 'test:publint': 'publint' }, req.isPublished);
        }

        updateAll(pkg.devDependencies, { publint: 'catalog:' }, req.isPublished);

        updateAll(
          pkg,
          {
            publishConfig: {
              access: 'public',
              exports: {
                development: {
                  types: './dist/dev/index.d.ts',
                  default: './dist/dev/index.js',
                },
                default: {
                  types: './dist/prod/index.d.ts',
                  default: './dist/prod/index.js',
                },
              },
              files: ['dist'],
            },
          },
          req.needsBuild
        );

        if (equals(pkg.files, ['dist'])) {
          delete pkg.files;
        }

        updateAll(
          pkg,
          {
            repository: {
              type: 'git',
              url: 'git+https://github.com/glimmerjs/glimmer-vm.git',
              directory: relative(workspaceDir, options.dir),
            },
          },
          req.isPublished
        );

        removeEmpty(pkg, 'scripts');
        removeEmpty(pkg, 'devDependencies');

        return pkg;
      },
      'tsconfig.json': (actual, options) => {
        const pkg = options.manifest;
        const req = workspace.project(options);

        if (!pkg.name) {
          return actual;
        }

        // If the package doesn't need a tsconfig, remove it
        if (!req.needsTsconfig) {
          return null;
        }

        let tsconfig = /** @type {TsConfig} */ (actual) ?? {
          extends: '../tsconfig.shared.json',
        };

        const include = req.includes;
        const types = req.types;

        const relativeDir = relative(workspaceDir, options.dir);
        const distDir = join(workspaceDir, 'ts-dist', relativeDir);
        const relativeDistDir = relative(options.dir, distDir);

        tsconfig.compilerOptions ??= {};
        tsconfig.compilerOptions.outDir = relativeDistDir;
        tsconfig.compilerOptions.composite = true;
        tsconfig.compilerOptions.incremental = true;

        updateAll(tsconfig.compilerOptions, { types }, types.length > 0);
        updateAll(tsconfig, { include });

        // We're looking at the root package, which has special references
        if (options.dir === workspaceDir) {
          /** @type {string[]} */
          const paths = [];

          for (const pkg of packages) {
            if (pkg.tsconfig && pkg.root !== workspaceDir) {
              paths.push(relative(workspaceDir, pkg.tsconfig));
            }
          }

          tsconfig.references = paths.map((path) => ({
            path,
          }));
        } else {
          const references = getReferences(options.dir, options.manifest).map((ref) => ({
            path: relative(workspaceDir, ref.tsconfig),
          }));

          if (references.length === 0) {
            delete tsconfig.references;
          } else {
            tsconfig.references = references;
          }
        }

        return tsconfig;
      },
    },
  });
}

/**
 * @param {object} obj
 * @param {object} updates
 * @param {boolean} [include] if false, delete keys
 */
function updateAll(obj, updates, include) {
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || include === false) {
      Reflect.deleteProperty(obj, key);
    } else {
      Reflect.set(obj, key, value);
    }
  }
}

/**
 * @param {string} pkgRoot
 * @param {ProjectManifest} pkg
 */
function getReferences(pkgRoot, pkg) {
  const allDeps = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);

  const workspaceDeps = [...allDeps].flatMap((dep) => {
    const depPkg = packages.find((p) => p.package.name === dep);

    if (depPkg?.tsconfig) {
      const relativeTsconfig = relative(pkgRoot, depPkg.tsconfig);
      return [{ name: depPkg.package.name, path: depPkg.root, tsconfig: relativeTsconfig }];
    } else {
      return [];
    }
  });

  return workspaceDeps;
}

/**
 * @param {object} parent
 * @param {string} key
 */
function removeEmpty(parent, key) {
  const value = Reflect.get(parent, key);

  if (Array.isArray(value) && value.length === 0) {
    Reflect.deleteProperty(parent, key);
  }

  if (value !== null && typeof value === 'object') {
    if (Object.keys(value).length === 0) {
      Reflect.deleteProperty(parent, key);
    }
  }
}
