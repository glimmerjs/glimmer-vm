/** @import { PackageInfo, RepoMeta } from './lib/types.js' */
import { resolve } from 'node:path';

import metadata from './metadata.json' with { type: 'json' };

export { default } from './metadata.json' with { type: 'json' };

export const WORKSPACE_ROOT = resolve(import.meta.dirname, '..');
export const BENCHMARK_ROOT = resolve(WORKSPACE_ROOT, 'benchmark/benchmarks/krausest');

/**
 * @param {string} packageName
 * @returns {PackageInfo | undefined}
 */
export function getPackageInfo(packageName) {
  return /** @type {RepoMeta} */ (metadata).packages.find((pkg) => pkg.name === packageName);
}

/**
 * @param {PackageInfo} pkg
 * @returns {boolean}
 */
export function isRoot(pkg) {
  return pkg.root === '';
}

/**
 * Get all workspace packages with their manifest and absolute rootDir.
 * This replaces @pnpm/workspace.find-packages functionality.
 * 
 * @returns {{ manifest: PackageInfo, rootDir: string }[]}
 */
export function getWorkspacePackages() {
  return /** @type {RepoMeta} */ (metadata).packages.map((pkg) => ({
    manifest: pkg,
    rootDir: resolve(WORKSPACE_ROOT, pkg.root || '.')
  }));
}
