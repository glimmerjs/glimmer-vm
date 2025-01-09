/* eslint-disable no-console */
/**
 * @import { FormatPluginFnOptions } from '@pnpm/meta-updater';
 * @import { PackageManifest, ProjectManifest } from '@pnpm/types';
 */

import { existsSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

import { readPackageJson } from '@pnpm/read-package-json';
import { findWorkspacePackagesNoCheck } from '@pnpm/workspace.find-packages';
import { statSync } from 'fs';
import { globbySync } from 'globby';
import { minimatch } from 'minimatch';
import { $, chalk } from 'zx';

const CODE_EXTENSIONS = ['js', 'd.ts', 'ts', 'mjs', 'mts', 'cjs', 'cts'];
const DEFAULT_PROJECT_FILES = ['rollup.config.mjs'];
const DEFAULT_PACKAGE_FILES = [...CODE_EXTENSIONS.map((ext) => `index.${ext}`), 'lib'];

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
   * @returns {string}
   */
  get root() {
    return this.#root;
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

  /**
   * @template T
   * @param {string} file
   * @param {T} contents
   * @param {(content: T, file: string) => void | Promise<void>} writer
   */
  async update(file, contents, writer) {
    // since we're actually writing a file, it's a good place to log that fact that we're updating
    // the file. In `--test` mode, the `meta-updater` harness prints out the dry run information
    // and the `write` function will never be called.
    const dir = dirname(file);
    const base = basename(file);
    const relativeDir = relative(this.#root, dir);
    const [prefix, rest] = relativeDir.startsWith('packages/')
      ? ['packages/', relativeDir.slice('packages/'.length)]
      : ['', relativeDir];

    console.error(
      `${chalk.green.bold('updating')} ${chalk.gray.dim(prefix)}${chalk.magenta.underline(
        rest
      )}${chalk.gray(`/`)}${chalk.cyanBright(base)}`
    );

    await writer(contents, file);
    await $({ verbose: false })`eslint --fix ${file}`;
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

    if (
      this.#manifest.name !== '@glimmer-workspace/krausest' &&
      this.#manifest.name !== '@glimmer-workspace/env'
    ) {
      types.push('@glimmer-workspace/env');
    }

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

  /**
   * Returns a list of patterns that should be included in the tsconfig.json file.
   *
   * If a `files` field is specified in the package.json, this code tries to stay
   * close to the patterns specified there, but makes some adjustments to ensure
   * that the patterns are tsconfig-compatible.
   *
   * @returns {string[]}
   */
  get includes() {
    const pkgRoot = this.#root;
    const manifest = this.#manifest;

    const allFiles = !manifest.files ? DEFAULT_PACKAGE_FILES : manifest.files;

    // First, split the specified files into directories and code files. This is
    // necessary because users can specify a directory in the `files` field without
    // any special indication that it's a directory (i.e. a trailing slash or glob
    // pattern for the containing files like `dir/**` is not required).
    const files = splitDirectories([...allFiles, 'test'], pkgRoot);

    return [
      // Format each specified directory as a list of glob patterns, one for each
      // code extension used in the directory.
      //
      // For example, if `files` is `["src"]`, this will return
      // a list like [`src/**‍/*.ts`, `src/**‍/*.mts`] (if the directory contains both
      // `.ts` and `.mts` files).
      ...formatDirsAsGlobs(files.directories ?? [], pkgRoot),

      // Resolve any files or globs specified in the `files` field, and convert them
      // into tsconfig-compatible patterns, trying to be as close as possible to the
      // patterns the user specified.
      ...consolidateIncludedFiles(files.code ?? [], allFiles),
    ];
  }
}

/**
 * @typedef {ProjectManifest & { type?: "commonjs" | "module", exports?: Record<string, string> | string }} PackageJson
 */

/**
 * @param {string[]} files
 * @param {string} cwd
 * @returns {{directories?: string[], code?: string[]} }
 */
function splitDirectories(files, cwd) {
  /**
   * @type {{type: ClassifiedFileType, path: string, absolute: string}[]}
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
  const codeFiles = classified.filter((f) => f.type === 'code-file').map((f) => f.path);

  const hasDirectories = directories.length > 0;
  const hasFiles = codeFiles.length > 0;

  /**
   * @type {{directories?: string[]; code?: string[]}}
   */
  const out = {};

  if (hasDirectories) {
    out.directories = directories;
  }

  if (hasFiles) {
    out.code = codeFiles;
  }

  return out;
}
/**
 * Convert the specified directories into glob patterns.
 *
 * For example, if `directories` is `["src"]`, this will return
 * a list like [`src/**‍/*.ts`, `src/**‍/*.mts`] (one for each code
 * extension used in the directory).
 *
 * It excludes `node_modules` and `dist` directories by default,
 * but you can pass in an `exclude` list to exclude specific
 * directories.
 *
 * @param {string[]} directories
 * @param {string} pkgRoot
 * @param {{exclude?: string[]}} [options]
 */
function formatDirsAsGlobs(directories, pkgRoot, { exclude = ['node_modules', 'dist'] } = {}) {
  /** @type {string[]} */
  const includes = [];

  for (const dir of directories) {
    const files = globbySync(dir, {
      cwd: pkgRoot,
      ignore: exclude.map((e) => `**/${e}/**`),
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
 * This function runs the globs and gets a list of the files matching them.
 *
 * If a glob specified in the `files` field is a tsconfig-compatible pattern,
 * then it's included directly in the tsconfig file.
 *
 * All other globs are consolidated into a minimal set of patterns: Each directory containing
 * matching files is turned into a pattern like `dir/*.ts` for each code extension used in the
 * directory.
 *
 * This is more annoying than it should be because the patterns supported by
 * `include` in `tsconfig.json` are a very restricted subset of normal glob
 * patterns.
 *
 * @see https://www.typescriptlang.org/tsconfig/#include
 *
 * @param {string[]} codeFiles
 * @param {string[]} specifiedFilesOrGlobs
 */
function consolidateIncludedFiles(codeFiles, specifiedFilesOrGlobs) {
  if (codeFiles.length === 0) return [];

  /**
   * Group the files by their directory.
   * @type {Record<string, string[]>}
   */
  const grouped = {};

  const includes = new Set();

  for (const file of codeFiles) {
    const dir = dirname(file);
    const base = basename(file);

    // If this file matches any of the specified files or globs, and the glob
    // is a tsconfig-compatible pattern, then we can just include it directly
    // in the tsconfig file.
    const matchingGlob = specifiedFilesOrGlobs.find((f) => matchLikeTsconfig(base, f));
    if (matchingGlob) {
      includes.add(matchingGlob);
      continue;
    }

    // Otherwise, we're going to consolidate this file into a directory pattern
    // instead.
    (grouped[dir] ??= []).push(base);
  }

  return [
    ...includes,
    ...Object.entries(grouped).flatMap(([dir, files]) => {
      return uniqueCodeExtensions(files).map((ext) => {
        return dir === '.' ? `*.${ext}` : `${dir}/*.${ext}`;
      });
    }),
  ];
}

/**
 * Check whether a file matches a specified pattern, using the minimal glob
 * patterns supported by `tsconfig.json`.
 *
 * @param {string} file
 * @param {string} pattern
 */
function matchLikeTsconfig(file, pattern) {
  // these settings should strip micromatch down to the bare minimum supported
  // by `tsconfig.json`
  return minimatch(file, pattern, { nobrace: true, noext: true, nonegate: true, nocomment: true });
}

/**
 * Returns a unique list of all code file extensions in the given list of paths.
 *
 * @param {string[]} paths
 */
function uniqueCodeExtensions(paths) {
  return Array.from(
    new Set(
      paths
        .filter((p) => !DEFAULT_PROJECT_FILES.includes(basename(p)))
        .map((path) => codeFileExtension(path))
        .filter(Boolean)
    )
  );
}

/**
 * @param {string} base
 * @param {{named?: string}} [options]
 * @returns {boolean}
 */
function isCodeFile(base, { named } = {}) {
  const ext = codeFileExtension(base);

  if (!ext) return false;

  if (named) {
    return minimatch(base, `${named}.${ext}`);
  }

  return true;
}

/**
 * @param {string | undefined} prefix
 * @param {string[]} files
 * @returns {string[]}
 */
function formatGlob(prefix, files) {
  const extensions = uniqueCodeExtensions(files);

  if (!prefix || extensions.length === 0) {
    return [];
  }

  return extensions.map((ext) => `${prefix}.${ext}`);
}

/**
 * @param {string} path
 * @returns {string | null}
 */
function codeFileExtension(path) {
  return CODE_EXTENSIONS.find((e) => path.endsWith(`.${e}`)) ?? null;
}

/** @typedef {'directory' | 'missing' | 'code-file' | 'other-file' | 'other-type'} ClassifiedFileType */

/**
 * @param {string} file
 * @param {string} relative
 * @returns {{type: ClassifiedFileType, path: string, absolute: string}}
 */
function classifyFile(file, relative) {
  if (!existsSync(file)) {
    return { type: 'missing', path: relative, absolute: file };
  }

  const stat = statSync(file);

  if (stat.isDirectory()) {
    return { type: 'directory', path: relative, absolute: file };
  } else if (stat.isFile()) {
    return {
      type: codeFileExtension(file) ? 'code-file' : 'other-file',
      path: relative,
      absolute: file,
    };
  } else {
    return { type: 'other-type', path: relative, absolute: file };
  }
}
