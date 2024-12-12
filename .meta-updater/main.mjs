// @ts-check
import { existsSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

import { findWorkspaceDir } from '@pnpm/find-workspace-dir';
import { createUpdateOptions } from '@pnpm/meta-updater';
import { readPackageJson } from '@pnpm/read-package-json';
import { findWorkspacePackagesNoCheck } from '@pnpm/workspace.find-packages';
import { globbySync } from 'globby';

import { code } from './code.mjs';
import { json } from './json.mjs';

/**
 * @import { FormatPluginFnOptions } from '@pnpm/meta-updater';
 * @import { PackageManifest, ProjectManifest } from '@pnpm/types';
 */

const workspaceRoot = await findWorkspaceDir(process.cwd());

if (!workspaceRoot) {
  throw new Error('Could not find workspace root');
}

const workspaceInfo = await workspacePackages(workspaceRoot);

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
      '.json': json,
      '#code': code,
    },
    files: {
      'rollup.config.mjs [#code]': (actual, options) => {
        // If the package needs to be built, generate a rollup config
        // that builds the package. This will be used by the `build`
        // script, which is set up below in `package.json`.
        if (packageNeedsBuild(options.manifest)) {
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

        const pkg = /** @type {ProjectManifest & { exports?: string }} */ (actual);

        pkg.scripts ??= {};
        pkg.devDependencies ??= {};

        const needsTsConfig = pkgNeedsTsConfig(pkg);
        const needsBuild = packageNeedsBuild(pkg);
        const isPublished = !pkg.private;
        const hasTests = existsSync(join(options.dir, 'test'));
        const isRoot = options.dir === workspaceDir;
        const isBench = options.manifest.name === '@glimmer-workspace/krausest';

        updateAll(pkg.devDependencies, { '@types/qunit': 'catalog:' }, hasTests);

        // Don't use catalog: dependencies in the benchmark package
        // until the base branch has been updated
        if (!isBench) {
          updateAll(
            pkg.devDependencies,
            { eslint: 'catalog:', typescript: 'catalog:' },
            needsTsConfig || isRoot
          );
        }

        if (!isRoot) {
          updateAll(
            pkg.scripts,
            { 'test:lint': 'eslint .', 'test:types': 'tsc --noEmit -p ./tsconfig.json' },
            hasTests
          );
        }

        // If the package needs to be built, add `@glimmer-workspace/build-support`
        // and `rollup` as devDependencies.
        updateAll(
          pkg.devDependencies,
          {
            '@glimmer-workspace/build-support': 'workspace:*',
            rollup: 'catalog:',
          },
          needsBuild
        );

        // Leave the build script in the root package alone
        if (!isRoot) {
          // If the package needs to be built, add a `build` script that
          // builds the package using rollup.
          updateAll(pkg.scripts, { build: 'rollup -c rollup.config.mjs' }, needsBuild);
        }

        // If the package is published, add `publint` as a devDependency
        // and a `test:publint` script that runs `publint`.
        updateAll(pkg.scripts, { 'test:publint': 'publint' }, isPublished);
        updateAll(pkg.devDependencies, { publint: 'catalog:' }, isPublished);

        updateAll(
          pkg,
          {
            repository: {
              type: 'git',
              url: 'git+https://github.com/glimmerjs/glimmer-vm.git',
              directory: relative(workspaceDir, options.dir),
            },
          },
          isPublished
        );

        // If there are no scripts, remove the `scripts` field
        if (Object.keys(pkg.scripts).length === 0) {
          delete pkg.scripts;
        }

        if (Object.keys(pkg.devDependencies).length === 0) {
          delete pkg.devDependencies;
        }

        return pkg;
      },
      'tsconfig.json': (actual, options) => {
        const pkg = options.manifest;

        if (!pkg.name) {
          return actual;
        }

        // If the package doesn't need a tsconfig, remove it
        if (!pkgNeedsTsConfig(pkg)) {
          return null;
        }

        let tsconfig = /** @type {TsConfig} */ (actual) ?? {
          extends: '../tsconfig.shared.json',
        };

        const include = includesList(options);
        const types = typesList(options);

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
            if (pkg.tsconfig) {
              paths.push(pkg.tsconfig);
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
 * A package needs a tsconfig if:
 *
 * 1. it doesn't have a name
 * 2. its name
 *
 * @param {ProjectManifest} pkg
 */
function pkgNeedsTsConfig(pkg) {
  return (
    !pkg.name ||
    (!pkg.name.startsWith('@glimmer-test/') && pkg.name !== '@glimmer-workspace/eslint-plugin')
  );
}

/**
 * The package needs to be built if it's:
 *
 * 1. public
 * 2. has an exports field that ends in .ts (but not .d.ts)
 *
 * @param {ProjectManifest & { exports?: string }} pkg
 */
function packageNeedsBuild(pkg) {
  return (
    !pkg.private &&
    typeof pkg.exports === 'string' &&
    pkg.exports.endsWith('.ts') &&
    !pkg.exports.endsWith('.d.ts')
  );
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

const CODE_EXTENSIONS = ['js', 'ts', 'mjs', 'mts', 'cjs', 'cts'];
const DEFAULT_PROJECT_FILES = ['rollup.config.mjs'];

/**
 * Returns a unique list of all file extensions in the given list of paths.
 *
 * @param {string[]} paths
 */
function uniqueExtensions(paths) {
  return Array.from(
    new Set(
      paths
        .filter((p) => !DEFAULT_PROJECT_FILES.includes(basename(p)))
        .map((path) => getExtension(path))
        .filter((ext) => ext && CODE_EXTENSIONS.includes(ext))
    )
  );
}

/**
 * @param {string} path
 * @returns {string | undefined}
 */
function getExtension(path) {
  return path.split('.').pop();
}

/**
 * @param {string} path
 * @returns {boolean}
 */
function isCodeFile(path) {
  const ext = getExtension(path);
  return ext ? CODE_EXTENSIONS.includes(ext) : false;
}

/**
 * Generate a list of TypeScript include patterns for the given package.
 *
 * @param {FormatPluginFnOptions} options
 */
function typesList(options) {
  const manifest = options.manifest;
  const devDeps = Object.keys(manifest.devDependencies ?? {});

  const hasTests = existsSync(join(options.dir, 'test'));

  /** @type {string[]} */
  const types = [];

  if (devDeps.includes('@types/node')) {
    types.push('node');
  }

  types.push('vite/client');

  if (hasTests) {
    types.push('qunit');
  }

  return types;
}

/**
 * Generate a list of TypeScript include patterns for the given package.
 *
 * @param {FormatPluginFnOptions} options
 */
function includesList(options) {
  const pkgRoot = options.dir;
  const manifest = options.manifest;

  const allFiles = manifest.files ? manifest.files : ['index.*', 'lib'];
  const files = splitDirectories([...allFiles, 'test'], pkgRoot);

  /** @type {string[]} */
  const includes = [];

  if (files.directories) {
    includes.push(...includedDirs(files.directories, pkgRoot));
  }

  if (files.other) {
    includes.push(...includedFiles(files.other, pkgRoot));
  }

  return includes;
}

/**
 * `directories` is a list of literal directories to include.
 *
 * @param {string[]} directories
 * @param {string} pkgRoot
 */
function includedDirs(directories, pkgRoot) {
  /** @type {string[]} */
  const includes = [];

  for (const dir of directories) {
    const files = globbySync(dir, {
      cwd: pkgRoot,
      ignore: ['**/node_modules/**', '**/dist/**'],
    });
    const glob = formatGlob(`${dir}/**/*`, files);
    if (glob) {
      includes.push(...glob);
    }
  }

  return includes;
}

/**
 * `files` is a list of files or globs to include.
 *
 * @param {string[]} filesOrGlobs
 * @param {string} pkgRoot
 */
function includedFiles(filesOrGlobs, pkgRoot) {
  const files = globbySync(filesOrGlobs, {
    cwd: pkgRoot,
    ignore: ['**/node_modules/**', '**/dist/**'],
  });

  /** @type {string[]} */
  const includes = [];

  for (const file of files) {
    if (isCodeFile(file)) {
      includes.push(file);
    }
  }

  return includes;
}

/**
 * @param {string | undefined} prefix
 * @param {string[]} files
 * @returns {string[]}
 */
function formatGlob(prefix, files) {
  const extensions = uniqueExtensions(files);

  if (!prefix || extensions.length === 0) {
    return [];
  }

  if (extensions.length === 1) {
    return [`${prefix}.${extensions[0]}`];
  } else {
    return extensions.map((ext) => `${prefix}.${ext}`);
  }
}

/**
 * @param {string[]} files
 * @param {string} cwd
 * @returns {{directories?: string[], other?: string[]} }
 */
function splitDirectories(files, cwd) {
  /**
   * @type {{type: 'directory' | 'file' | 'other' | 'missing', path: string}[]}
   */
  const classified = [];

  for (const file of files) {
    const fullPath = resolve(cwd, file);
    if (existsSync(fullPath)) {
      classified.push(classifyFile(fullPath, relative(cwd, fullPath)));
    } else {
      const expanded = globbySync(file, {
        cwd,
        ignore: ['**/node_modules/**', '**/dist/**'],
        absolute: true,
        onlyFiles: true,
      });

      classified.push(...expanded.map((f) => classifyFile(f, relative(cwd, f))));
    }
  }

  const directories = classified.filter((f) => f.type === 'directory').map((f) => f.path);
  const other = classified.filter((f) => f.type === 'file').map((f) => f.path);

  const hasDirectories = directories.length > 0;
  const hasFiles = other.length > 0;

  const out = {};

  if (hasDirectories) {
    out.directories = directories;
  }

  if (hasFiles) {
    out.other = other;
  }

  return out;
}

/**
 * @param {string} file
 * @param {string} relative
 * @returns {{type: 'directory' | 'missing' | 'file' | 'other', path: string, absolute: string}}
 */
function classifyFile(file, relative) {
  if (!existsSync(file)) {
    return { type: 'missing', path: relative, absolute: file };
  }

  const stat = statSync(file);

  if (stat.isDirectory()) {
    return { type: 'directory', path: relative, absolute: file };
  } else if (stat.isFile()) {
    return { type: 'file', path: relative, absolute: file };
  } else {
    return { type: 'other', path: relative, absolute: file };
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
 * @param {string} root
 * @returns {Promise<{root: string; package: PackageManifest; tsconfig?: string | undefined}[]>}
 */
async function workspacePackages(root) {
  const packages = await findWorkspacePackagesNoCheck(root);

  if (packages === null || packages === undefined) {
    throw new Error('Could not find workspace info');
  } else {
    return Promise.all(
      packages.map(async (pkg) => {
        const packageJson = await readPackageJson(resolve(pkg.rootDir, 'package.json'));
        const tsconfig = pkgNeedsTsConfig(packageJson)
          ? resolve(pkg.rootDir, 'tsconfig.json')
          : undefined;
        return {
          root: pkg.rootDir,
          package: packageJson,
          tsconfig,
        };
      })
    );
  }
}
