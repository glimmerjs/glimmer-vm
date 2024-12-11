// @ts-check
import { existsSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

import { pnpmWorkspaceInfo } from '@node-kit/pnpm-workspace-info';
import { findWorkspaceDir } from '@pnpm/find-workspace-dir';
import { createUpdateOptions } from '@pnpm/meta-updater';
import { readPackageJson } from '@pnpm/read-package-json';
import { globbySync } from 'globby';
import { equals } from 'ramda';
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
 * @typedef {{compilerOptions?: { composite?: boolean; incremental?: boolean; outDir?: string}; include?: string[]; references?: ({path: string})[]}} TsConfig
 */

/**
 * @param {string} workspaceDir
 */
export default function main(workspaceDir) {
  return createUpdateOptions({
    'package.json': (actual, options) => {
      if (!actual) {
        return actual;
      }

      const pkg = /** @type {ProjectManifest} */ (actual);

      const files = options.manifest.files;
      if (equals(files, ['dist'])) {
        pkg.publishConfig = {
          ...pkg.publishConfig,
          files: ['dist'],
        };

        delete pkg.files;
      }

      return pkg;
    },
    'tsconfig.json': (actual, options) => {
      const tsconfig = /** @type {TsConfig} */ (actual);

      if (!tsconfig) {
        return tsconfig;
      }

      const include = includesList(options);

      const relativeDir = relative(workspaceDir, options.dir);
      const distDir = join(workspaceDir, 'ts-dist', relativeDir);
      const relativeDistDir = relative(options.dir, distDir);

      tsconfig.compilerOptions ??= {};
      tsconfig.compilerOptions.outDir = relativeDistDir;
      tsconfig.compilerOptions.composite = true;
      tsconfig.compilerOptions.incremental = true;
      // delete tsconfig.compilerOptions.outDir;

      tsconfig.include = include;

      if (options.dir === workspaceDir) {
        const paths = [];

        for (const pkg of packages) {
          if (existsSync(resolve(pkg.root, 'tsconfig.json'))) {
            paths.push(pkg.root);
          }
        }

        tsconfig.references = paths.map((path) => ({
          path,
        }));
      } else {
        const references = getReferences(options.dir, options.manifest).map((ref) => ({
          path: ref.tsconfig,
        }));

        if (references.length === 0) {
          delete tsconfig.references;
        } else {
          tsconfig.references = references;
        }
      }

      return tsconfig;
    },
  });
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
function includesList(options) {
  const pkgRoot = options.dir;
  const manifest = options.manifest;

  const files = manifest.files
    ? splitDirectories(manifest.files ?? [], pkgRoot)
    : splitDirectories(['index.*', 'lib', 'test'], pkgRoot);

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
  const packages = await pnpmWorkspaceInfo(root);

  if (packages === null || packages === undefined) {
    throw new Error('Could not find workspace info');
  } else {
    return Promise.all(
      Object.entries(packages).map(async ([_pkg, { path }]) => {
        const packageJson = await readPackageJson(resolve(path, 'package.json'));
        const tsconfig = resolve(path, 'tsconfig.json');
        return {
          root: path,
          package: packageJson,
          tsconfig: existsSync(tsconfig) ? tsconfig : undefined,
        };
      })
    );
  }
}
