/**
 * @import { FormatPluginFnOptions } from '@pnpm/meta-updater';
 * @import { PackageManifest, ProjectManifest } from '@pnpm/types';
 */

import { existsSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

import { readPackageJson } from '@pnpm/read-package-json';
import { findWorkspacePackagesNoCheck } from '@pnpm/workspace.find-packages';
import { statSync } from 'fs';
import { globbySync } from 'globby';
import { equals } from 'ramda';

const CODE_EXTENSIONS = ['js', 'ts', 'mjs', 'mts', 'cjs', 'cts'];
const DEFAULT_PROJECT_FILES = ['rollup.config.mjs'];

export class Workspace {
  /**
   * @param {string} root
   */
  static of(root) {
    return new Workspace(root);
  }

  /** @type {string} */
  #root;

  /**
   * @param {string} root
   */
  constructor(root) {
    this.#root = root;
  }

  /**
   * @param {FormatPluginFnOptions} options
   */
  project(options) {
    return new ProjectRequirements(this.#root, options.dir, options.manifest);
  }

  /**
   * @param {string} root
   * @param {PackageManifest} packageJson
   */
  package(root, packageJson) {
    return new ProjectRequirements(this.#root, root, packageJson);
  }

  /**
   * @returns {Promise<{root: string; package: PackageManifest; tsconfig?: string | undefined}[]>}
   */
  async packages() {
    const packages = await findWorkspacePackagesNoCheck(this.#root);

    if (packages === null || packages === undefined) {
      throw new Error('Could not find workspace info');
    } else {
      return Promise.all(
        packages.map(async (pkg) => {
          const packageJson = await readPackageJson(resolve(pkg.rootDir, 'package.json'));
          const tsconfig = this.package(pkg.rootDir, packageJson).needsTsconfig
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
}

export class ProjectRequirements {
  /**
   * @type {string}
   */
  #workspaceRoot;

  /** @type {string} */
  #root;

  /** @type {PackageJson} */
  #manifest;

  /**
   * @param {string} workspaceRoot
   * @param {string} root
   * @param {PackageJson} manifest
   */
  constructor(workspaceRoot, root, manifest) {
    this.#workspaceRoot = workspaceRoot;
    this.#root = root;
    this.#manifest = manifest;
  }

  get isRoot() {
    return this.#root === this.#workspaceRoot;
  }

  /**
   * A package needs a tsconfig if:
   *
   * 1. it doesn't have a name
   * 2. its name doesn't start with @glimmer-test/
   * 3. its type is not "commonjs"
   *
   * The @glimmer-test/ rule should probably be replaced with a
   * check for `keywords.includes('tests')`
   */
  get needsTsconfig() {
    const pkg = this.#manifest;

    if (pkg.type === 'commonjs') {
      return false;
    }

    if (!pkg.name) {
      return true;
    }

    if (pkg.name.startsWith('@glimmer-test/')) {
      return false;
    }

    return true;
  }

  get isBench() {
    return this.#manifest.name === '@glimmer-workspace/krausest';
  }

  get isPublished() {
    return this.#manifest.private !== true;
  }

  /**
   * The package needs to be built if it's:
   *
   * 1. public
   * 2. has an exports field that ends in .ts (but not .d.ts)
   */
  get needsBuild() {
    const pkg = this.#manifest;

    return (
      this.isPublished &&
      typeof pkg.exports === 'string' &&
      pkg.exports.endsWith('.ts') &&
      !pkg.exports.endsWith('.d.ts')
    );
  }

  /**
   * Generate a list of TypeScript include patterns for the given package.
   */
  get types() {
    /** @type {string[]} */
    const types = [];

    types.push('vite/client');

    if (this.needsTestTypes) {
      types.push('qunit');
    }

    if (this.needsNodeTypes) {
      types.push('node');
    }

    return types.sort();
  }

  get needsNodeTypes() {
    return !!this.#manifest.keywords?.includes('node');
  }

  /**
   * @returns {boolean}
   */
  get needsTestTypes() {
    return !!(this.hasTests || this.#manifest.keywords?.includes('test-utils'));
  }

  get hasTests() {
    return existsSync(join(this.#root, 'test'));
  }

  get includes() {
    const DEFAULT_FILES = ['index.*', 'lib'];

    const pkgRoot = this.#root;
    const manifest = this.#manifest;

    const allFiles =
      !manifest.files || equals(manifest.files, ['dist']) ? DEFAULT_FILES : manifest.files;

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
}

/**
 * @typedef {ProjectManifest & { type?: "commonjs" | "module", exports?: Record<string, string> | string }} PackageJson
 */

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
 * @param {string} path
 * @returns {boolean}
 */
function isCodeFile(path) {
  const ext = getExtension(path);
  return ext ? CODE_EXTENSIONS.includes(ext) : false;
}

/**
 * @param {string} path
 * @returns {string | undefined}
 */
function getExtension(path) {
  return path.split('.').pop();
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
