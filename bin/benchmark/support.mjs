// @ts-check

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { execa } from 'execa';

/**
 * @import {WorkspaceOptions, Config} from './types.d.ts';
 * @import {ExecaChildProcess} from 'execa';
 */

export class Benchmark {
  /**
   * @param {Config} options
   */
  static async initialize(options) {
    if (!options.offline) {
      await $({ cwd: options.root })`git fetch`;
    }

    const scenarios = {};

    if (options.control.run) {
      scenarios.control = await Scenario.create('control', options);
    }

    if (options.experiment.run) {
      scenarios.experiment = await Scenario.create('experiment', options);
    }

    return new Benchmark(options, scenarios);
  }

  /**
   * @readonly
   * @type {Config}
   */
  options;

  /**
   * @readonly
   */
  scenarios;

  /**
   * @param {Config} options
   * @param {Partial<Record<'control' | 'experiment', Scenario>>} scenarios
   */
  constructor(options, scenarios) {
    this.options = options;
    this.scenarios = scenarios;
  }

  /**
   * @returns {Partial<Record<'control' | 'experiment', import('execa').ExecaChildProcess<string>>>}
   */
  run() {
    return Object.fromEntries(
      Object.entries(this.scenarios).map(([name, scenario]) => [name, scenario.serve()])
    );
  }
}

export class Scenario {
  /**
   * @param {'control' | 'experiment'} name
   * @param {Config} options
   */
  static async create(name, options) {
    const ref = options[name].ref;
    const rev = await $({ cwd: options.workspaceRoot })`git rev-parse ${ref}`;

    return new Scenario(name, rev.stdout.trim(), options);
  }

  /** @readonly */
  name;

  /** @readonly */
  #options;

  /** @readonly */
  #rev;

  /**
   * @param {'control' | 'experiment'} name
   * @param {string} rev
   * @param {Config} options
   */
  constructor(name, rev, options) {
    this.name = name;
    this.#rev = rev;
    this.#options = options;
  }

  /**
   * The temporary directory where the scenario is located. It contains a clone of the
   * glimmer-vm repository, checked out at `this.#rev`.
   */
  get dir() {
    return join(this.#options.tmpdir, this.name);
  }

  get benchDir() {
    return join(this.dir, 'benchmark', 'benchmarks', 'krausest');
  }

  get url() {
    return `http://localhost:${this.#options[this.name].port}`;
  }

  async reset() {
    if (this.#scenarioConfig.run === 'reset') {
      await $`rm -rf ${this.dir}`;
    }

    await $`mkdir -p ${this.dir}`;
  }

  get shouldServe() {
    return this.#scenarioConfig.serve;
  }

  /**
   * @returns {ExecaChildProcess<string> | undefined}
   */
  serve() {
    if (!this.shouldServe) return;

    return execa('pnpm', ['vite', 'preview', '--port', String(this.#options[this.name].port)], {
      cwd: this.benchDir,
      stdio: 'inherit',
    });
  }

  get #scenarioConfig() {
    return this.#options[this.name];
  }

  async report() {
    return this.#$`pwd`;
  }

  async setupBenchmarks() {
    // If we're repeating the benchmark, leave the benchmark directory and its node_modules
    // alone.
    if (this.#scenarioConfig.run === 'repeat') {
      return;
    }

    // If we're rebuilding or resetting the benchmark and this is the control scenario, remove the
    // benchmark directory and copy it from the glimmer-vm checkout, but remove the node_modules
    // directories inside of it.
    if (this.name === 'control') {
      await this.#$`rm -rf ${this.#subdir('benchmark')}`;

      await this.#$`cp -r ${join(this.#options.workspaceRoot, 'benchmark/')} ${this.#subdir(
        'benchmark/'
      )}`;
      await this.#$`rm -rf ${this.#subdir('benchmark/node_modules')}`;
      await this.#$`rm -rf ${this.#subdir('benchmark/benchmarks/krausest/node_modules')}`;
    }

    // If this is the experiment scenario, the earlier `git fetch` got the scenario up to
    // date, and `pnpm install` will update the node_modules directories, so there's nothing
    // to do here.
  }

  async pnpmInstall() {
    await this.#$`pnpm --version`;

    if (this.#scenarioConfig.run !== 'repeat') {
      // the no-frozen-lockfile flag and no-strict-peer-dependencies flag are necessary to
      // allow the current benchmark directory to install properly. TODO: make the benchmark
      // environment more self-contained
      await this.#$`pnpm install --no-frozen-lockfile --color --no-strict-peer-dependencies ${
        this.#options.offline ? '--offline' : ''
      }`;
    }
  }

  async pnpmBuild() {
    if (this.#scenarioConfig.run !== 'repeat') {
      // @todo turbo should make this a non-issue
      await this.#$`pnpm build`;
    }
  }

  async viteBuild() {
    if (this.#scenarioConfig.run !== 'repeat') {
      const tsconfigPath = this.#subdir('benchmark/tsconfig.json');

      // Once we land the infra update, we won't need to check for this anymore since all control
      // checkouts will have a `tsconfig.json` here
      if (existsSync(tsconfigPath)) {
        // Remove the `references` field from `tsconfig.json` because the references in the current
        // checkout may not be compatible with the control checkout.
        const tsconfig = JSON.parse(
          await readFile(this.#subdir('benchmark/tsconfig.json'), { encoding: 'utf8' })
        );
        delete tsconfig['references'];
        await writeFile(
          this.#subdir('benchmark/tsconfig.json'),
          JSON.stringify(tsconfig, null, 2),
          {
            encoding: 'utf8',
          }
        );
      }

      await $({ cwd: this.benchDir })`pnpm vite build`;
    }
  }

  /**
   * Rewrite all `package.json`s with a `publishConfig` field with the fields specified in
   * `publishConfig`.
   */
  async rewritePackageJson() {
    // @todo use @pnpm/workspace.find-packages
    // limit to `@glimmer/*` packages
    const packages = await this.#$`find ./packages/@glimmer -name 'package.json'`;

    for (const pkg of packages.stdout.trim().split('\n')) {
      const packageJson = JSON.parse(await readFile(pkg, { encoding: 'utf8' }));
      const publishConfig = packageJson['publishConfig'];

      // assume that the presence of a `publishConfig` field means that the package is
      // a published package and needs its package.json updated to behave like a published
      // package in the benchmark environment.
      if (publishConfig) {
        const updatedPkg = { ...packageJson, ...publishConfig };

        for (const [key, value] of Object.entries(publishConfig)) {
          if (value === null) {
            delete updatedPkg[key];
          }
        }

        await writeFile(pkg, JSON.stringify(updatedPkg, null, 2), { encoding: 'utf8' });
      }
    }
  }

  async clone() {
    switch (this.#scenarioConfig.run) {
      case 'repeat':
      case 'rebuild':
        if (existsSync(this.#subdir('.git'))) {
          // just update the local copy of the repo to the `.git` database in the
          // glimmer-vm checkout
          await this.#$`git fetch`;
          break;
        }
      case 'reset':
        // clone the `.git` database from the glimmer-vm checkout into the temporary
        // directory
        await this.#$`git clone ${join(this.#options.workspaceRoot, '.git')} .`;
        break;
    }

    await this.#$`git checkout --force ${this.#rev}`;
  }

  /**
   * @param {string} path
   */
  #subdir(path) {
    return join(this.dir, path);
  }

  get #$() {
    return $({ cwd: this.dir });
  }
}
