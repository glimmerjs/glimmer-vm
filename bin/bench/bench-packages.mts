import { join, relative, resolve } from 'node:path';

import type { PackageJson } from 'type-fest';
import { getWorkspacePackages, type WorkspacePackage } from '@glimmer-workspace/repo-metadata';
import chalk from 'chalk';
import { $ } from 'execa';
import fs from 'fs-extra';

const { writeFile } = fs;

interface Roots {
  /**
   * The target directory containing the `krausest` benchmark that will get the build packages.
   */
  benchmark: string;
  /**
   * The workspace containing the packages that will be built.
   */
  workspace: string;
}

/**
 * Build the dependencies of the `krausest` benchmark, put them into the (gitignored) `packages/`
 * directory, and update the `package.json` to point to them if necessary.
 *
 * @param format Whether to run `eslint --fix` and `prettier --write` on the manifest.
 */
export async function buildKrausestDeps({
  roots,
  format = false,
}: {
  roots: Roots;
  format?: boolean | undefined;
}) {
  const packages = getWorkspacePackages();

  const benchEnvPkg = getPkg(packages, '@glimmer-workspace/benchmark-env');
  const benchEnvManifest = await getManifest(roots, benchEnvPkg.rootDir);

  const krausestManifest = await getManifest(roots, roots.benchmark);

  const benchEnvDeps = neededDeps(packages, benchEnvManifest);
  const krausestDeps = neededDeps(packages, krausestManifest);

  // Ensure the packages directory exists
  const packagesDir = join(roots.benchmark, 'packages');
  await fs.ensureDir(packagesDir);

  // First, ensure all packages are built using turbo (with caching)
  console.log(chalk.cyan('Building packages with turbo...'));
  await $({ cwd: roots.workspace, stdio: 'inherit' })`pnpm turbo prepack`;
  
  // Then pack them using turbo pack:local (which also benefits from caching)
  console.log(chalk.cyan('Packing benchmark packages...'));
  await $({ cwd: roots.workspace, stdio: 'inherit' })`pnpm turbo pack:local`;

  // Collect the built packages info
  const allDeps = new Set([benchEnvPkg, ...benchEnvDeps, ...krausestDeps]);
  const built = [...allDeps].map(pkg => ({
    name: pkg.manifest.name!,
    filename: relative(roots.benchmark, join(roots.benchmark, 'packages', `${pkg.manifest.name}.tgz`))
  }));

  {
    const deps = krausestManifest.dependencies ?? {};
    krausestManifest.dependencies = deps;
    const devDeps = krausestManifest.devDependencies ?? {};
    krausestManifest.devDependencies = devDeps;
    const overrides = krausestManifest.pnpm?.overrides ?? {};
    krausestManifest.pnpm ??= {};
    krausestManifest.pnpm.overrides = overrides;

    for (const pkg of built) {
      const filename = `file:${pkg.filename}`;

      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      update(pkg.name, ['dependencies', deps], filename) ||
        update(pkg.name, ['devDependencies', devDeps], filename) ||
        update(pkg.name, ['pnpm.overrides', overrides], filename, { fallback: true });
    }

    /**
     * Remove any leftover overrides for packages that no longer exist. Since the overrides are
     * added to the package.json file based on transitive dependencies, it's possible that a
     * previous run of `buildKrausestDeps` added a transitive override that is no longer used by any
     * direct dependencies of the `krausest` benchmark package.
     */
    for (const [name, value] of Object.entries(overrides)) {
      if (isNeededDep(value) && !allDeps.has(getPkg(packages, name))) {
        console.log(
          `${chalk.red('[-]')} ${chalk.strikethrough(name)} ${chalk.gray('from')} ${'pnpm.overrides'.padEnd(MAX_PAD)}`
        );

        delete overrides[name];
      }
    }

    await writeManifest(roots, join(roots.benchmark, 'package.json'), krausestManifest, format);
  }
}

type PnpmPackageJson = PackageJson & {
  pnpm?: {
    overrides?: Record<string, string>;
  };
};

async function getManifest(roots: Roots, path: string): Promise<PnpmPackageJson> {
  const { default: manifest }: { default: PnpmPackageJson } = await import(
    path.startsWith('.')
      ? resolve(`${roots.workspace}`, path, 'package.json')
      : resolve(path, 'package.json'),
    { with: { type: 'json' } }
  );

  return manifest;
}

async function writeManifest(
  roots: Roots,
  path: string,
  manifest: PnpmPackageJson,
  format: boolean
) {
  await writeFile(path, JSON.stringify(manifest, null, 2));

  if (format) {
    await $({ cwd: roots.workspace })`eslint --fix ${path}`;
    await $({ cwd: roots.workspace })`prettier --write ${path}`;
  }
}

function getPkg(packages: WorkspacePackage[], name: string): WorkspacePackage {
  const pkg = packages.find((pkg) => pkg.manifest.name === name);

  if (!pkg) {
    throw new Error(`Could not find package ${name}`);
  }

  return pkg;
}

function neededDeps(packages: WorkspacePackage[], manifest: PnpmPackageJson): WorkspacePackage[] {
  const allDeps = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.pnpm?.overrides,
  };

  const workspaceDeps = Object.entries(allDeps)
    .flatMap(([name, value]) => (value && isNeededDep(value) ? [name] : []))
    .flatMap((name) => packages.find((pkg) => pkg.manifest.name === name)!);

  return workspaceDeps;
}

function isNeededDep(version: string) {
  return version.startsWith('workspace:') || version.startsWith('file:');
}

const MAX_PAD = 'devDependencies'.length;

function update(
  pkg: string,
  location: [name: string, container: Partial<Record<string, string>>],
  to: string,
  options?: { fallback: true }
) {
  const [containerName, container] = location;

  if (pkg in container) {
    if (container[pkg] !== to) {
      console.log(
        `${chalk.yellow('[~]')} ${chalk.cyan(pkg)} ${containerName.padEnd(MAX_PAD)} ${chalk.gray('from')} ${chalk.red.strikethrough(container[pkg])} ${chalk.gray('->')} ${chalk.green(to)}`
      );
      container[pkg] = to;
    }

    return true;
  } else if (options?.fallback) {
    console.log(
      `${chalk.green('[+]')} ${chalk.cyan(pkg)} ${containerName.padEnd(MAX_PAD)} ${chalk.gray('as')} ${chalk.green(to)}`
    );

    container[pkg] = to;

    return true;
  }

  return false;
}


if (process.argv[1] === import.meta.filename) {
  const { BENCHMARK_ROOT, WORKSPACE_ROOT } = await import('@glimmer-workspace/repo-metadata');

  await buildKrausestDeps({
    roots: { benchmark: BENCHMARK_ROOT, workspace: WORKSPACE_ROOT },
    format: true,
  });
  await $({
    cwd: BENCHMARK_ROOT,
    verbose: true,
    env: { CI: 'false' },
  })`pnpm install --ignore-workspace --no-lockfile`;
}
