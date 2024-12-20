// @ts-check

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import chalk from 'chalk';
import { execa } from 'execa';
import { $, fs } from 'zx';

/**
 * @import {Config} from './types.d.ts';
 * @import {ExecaChildProcess} from 'execa';
 */

export class BenchmarkRunner {
  /**
   * Initialize the benchmark runner with the options provided by the command line and environment.
   *
   * Unless `--offline` is passed, this fetches the remote so that the `control` scenario is up to date.
   *
   * @param {Config} options
   */
  static async initialize(options) {
    if (!options.offline) {
      await $({ cwd: options.workspaceRoot })`git fetch`;
    }

    const scenarios = {};

    if (options.control.build) {
      scenarios.control = await Scenario.create('control', options);
    }

    if (options.experiment.build) {
      scenarios.experiment = await Scenario.create('experiment', options);
    }

    return new BenchmarkRunner(options, scenarios);
  }

  /**
   * @readonly
   * @type {Config}
   */
  #options;

  /**
   * @readonly
   * @type {ExecaChildProcess<string>[]}
   */
  #processes = [];

  /**
   * @readonly
   */
  scenarios;

  /**
   * @param {Config} options
   * @param {Partial<Record<'control' | 'experiment', Scenario>>} scenarios
   */
  constructor(options, scenarios) {
    this.#options = options;
    this.scenarios = scenarios;

    process.on('SIGINT', () => {
      Object.values(this.#processes).forEach((process) => process?.kill());
    });
  }

  /**
   * Serve the scenarios that didn't specify `serve=off`.
   *
   * This function is intentionally **not** `async` so that the server remains up while the
   * tracerbench script runs.
   *
   * @param {Scenario} scenario
   */
  serve(scenario) {
    const process = scenario.serve();

    if (process) {
      this.#processes.push(process);
    }
  }

  async bench() {
    const {
      env: { fidelity, markers, throttleRate },
      workspaceRoot,
    } = this.#options;
    const { control, experiment } = this.scenarios;

    if (!control?.shouldServe || !experiment?.shouldServe) {
      if (this.#options.loglevel.shouldTrace) {
        log('runner', 'bench', 'Skipping benchmarks (serve mode is off)');
      }
      return;
    }

    try {
      const output = await $({
        cwd: workspaceRoot,
        verbose: this.#options.loglevel.shouldTrace,
        stdio: 'inherit',
      })`node --single-threaded-gc ./node_modules/tracerbench/bin/run compare --regressionThreshold 25 --sampleTimeout 60 --fidelity ${fidelity} --markers ${markers.join(
        ','
      )} --controlURL ${control.url} --experimentURL ${
        experiment.url
      } --report --headless --cpuThrottleRate ${throttleRate}`;

      const results = resolve(this.#options.workspaceRoot, 'tracerbench-results');
      fs.ensureDirSync(results);
      fs.writeFileSync(
        resolve(results, 'msg.txt'),
        output.stdout.split('Benchmark Results Summary').pop() ?? ''
      );
    } catch (p) {
      console.error(p);
      // eslint-disable-next-line n/no-process-exit
      process.exit(1);
    }

    // eslint-disable-next-line n/no-process-exit
    process.exit(0);
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

  get shouldServe() {
    return this.#scenarioConfig.build !== 'off' && this.#scenarioConfig.serve !== 'off';
  }

  get shouldBuild() {
    return this.#scenarioConfig.build !== 'off';
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

  /**
   * @returns {ExecaChildProcess<string> | undefined}
   */
  #serve() {
    return execa('pnpm', ['vite', 'preview', '--port', String(this.#options[this.name].port)], {
      verbose: this.#shouldEchoCommands,
      cwd: this.benchDir,
      stdio: 'inherit',
    });
  }

  get #scenarioConfig() {
    return this.#options[this.name];
  }

  async setupRepo() {
    if (!this.shouldBuild) {
      this.#debug('build', 'Skipping build (build mode is off)');
      return;
    }

    await this.#resetStep();
    await this.#reportStep();
    await this.#cloneStep();
    await this.#setupBenchmarksStep();
    await this.#pnpmInstallStep();
    await this.#pnpmBuildStep();
    await this.#rewritePackageJsonStep();
    await this.#viteBuildStep();
  }

  /**
   * @returns {ExecaChildProcess<string> | undefined}
   */
  serve() {
    if (this.shouldServe) {
      this.#trace('serve', 'Starting server');
      return this.#serve();
    } else {
      this.#trace('serve', 'Skipping server (serve mode is off)');
    }
  }

  async #resetStep() {
    if (this.#scenarioConfig.build === 'reset') {
      this.#debug('reset', `Removing ${this.dir}`);

      await $`rm -rf ${this.dir}`;
    } else {
      this.#debug('reset', `Ensuring ${this.dir}`);
    }

    await $({ verbose: this.#shouldEchoCommands })`mkdir -p ${this.dir}`;
  }

  async #reportStep() {
    if (this.#options.loglevel.shouldTrace) {
      return this.#$`pwd`;
    }
  }

  async #cloneStep() {
    switch (this.#scenarioConfig.build) {
      case 'repeat':
      case 'rebuild':
        if (existsSync(this.#subdir('.git'))) {
          this.#debug(
            'clone',
            `Updating git repo from local checkout (${this.#options.workspaceRoot})`
          );

          // just update the local copy of the repo to the `.git` database in the
          // glimmer-vm checkout
          await this.#$`git fetch`;
          break;
        }
      case 'reset':
        // clone the `.git` database from the glimmer-vm checkout into the temporary
        // directory
        this.#debug(
          'clone',
          `Cloning git repo from local checkout (${this.#options.workspaceRoot})`
        );
        await this.#$`git clone ${join(this.#options.workspaceRoot, '.git')} .`;
        break;
    }

    this.#debug('clone', `Checking out ${this.#rev}`);
    await this.#$`git checkout --force ${this.#rev}`;
  }

  async #setupBenchmarksStep() {
    if (this.#scenarioConfig.build === 'repeat') {
      this.#trace('setup benchmarks', 'Skipping benchmarks (build mode is repeat)');
      return;
    }

    // If we're rebuilding or resetting the benchmark and this is the control scenario, remove the
    // benchmark directory and copy it from the glimmer-vm checkout, but remove the node_modules
    // directories inside of it.
    if (this.name === 'control') {
      this.#debug('setup benchmarks', 'Restoring benchmarks to current glimmer-vm checkout');
      await this.#$`rm -rf ${this.#subdir('benchmark')}`;

      await this.#$`cp -r ${join(this.#options.workspaceRoot, 'benchmark/')} ${this.#subdir(
        'benchmark/'
      )}`;
      await this.#$`rm -rf ${this.#subdir('benchmark/node_modules')}`;
      await this.#$`rm -rf ${this.#subdir('benchmark/benchmarks/krausest/node_modules')}`;
    } else {
      // If this is the experiment scenario, the earlier `git fetch` got the scenario up to
      // date, and `pnpm install` will update the node_modules directories, so there's nothing
      // to do here.
      this.#trace('setup benchmarks', 'Benchmarks were restored from current glimmer-vm checkout');
    }
  }

  async #pnpmInstallStep() {
    if (this.#options.loglevel.shouldTrace) {
      await this.#$`pnpm --version`;
    }

    if (this.#scenarioConfig.build !== 'repeat') {
      this.#debug('install', 'Installing dependencies');

      // the no-frozen-lockfile flag and no-strict-peer-dependencies flag are necessary to
      // allow the current benchmark directory to install properly. TODO: make the benchmark
      // environment more self-contained
      await this.#$`pnpm install --no-frozen-lockfile --color --no-strict-peer-dependencies ${
        this.#options.offline ? '--offline' : ''
      }`;
    }
  }

  async #pnpmBuildStep() {
    // @todo turbo should make this a non-issue
    if (this.#scenarioConfig.build === 'repeat') {
      this.#trace('build', 'Skipping build (build mode is repeat)');
      return;
    }

    this.#debug('build', 'Building packages');
    await this.#$({ verbose: true })`pnpm build --output-logs=new-only`;
  }

  /**
   * Rewrite all `package.json`s with a `publishConfig` field with the fields specified in
   * `publishConfig`.
   */
  async #rewritePackageJsonStep() {
    this.#debug('rewrite package.json', 'Rewriting package.json files to simulate publishing');

    // @todo use @pnpm/workspace.find-packages
    // limit to `@glimmer/*` packages
    const packages = await this.#$`find ./packages/@glimmer -name 'package.json'`;

    for (const relativePkg of packages.stdout.trim().split('\n')) {
      const pkg = join(this.dir, relativePkg);
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

  async #viteBuildStep() {
    if (this.#scenarioConfig.build === 'repeat') {
      this.#trace('vite build', 'Skipping vite build (build mode is repeat)');
      return;
    }

    this.#debug('vite build', `Building benchmarks with vite in ${this.benchDir}`);

    const tsconfigPath = join(this.benchDir, 'tsconfig.json');

    // Once we land the infra update, we won't need to check for this anymore since all control
    // checkouts will have a `tsconfig.json` here
    if (existsSync(tsconfigPath)) {
      // Remove the `references` field from `tsconfig.json` because the references in the current
      // checkout may not be compatible with the control checkout.
      //
      // for the record, trying to mix the current `benchmark` directory with the control will
      // always have a lot of problems unless we have a better way to make it self-contained, which
      // is difficult because it wants to use the control's `benchmark-env`.

      const tsconfig = JSON.parse(await readFile(tsconfigPath, { encoding: 'utf8' }));
      delete tsconfig['references'];

      await writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2), {
        encoding: 'utf8',
      });
    }

    await $({ cwd: this.benchDir })`pnpm vite build`;
  }

  /**
   * @param {string} path
   */
  #subdir(path) {
    return join(this.dir, path);
  }

  get #$() {
    return $({ verbose: this.#shouldEchoCommands, cwd: this.dir });
  }

  get #shouldEchoCommands() {
    return this.#options.loglevel.shouldTrace;
  }

  /**
   * @param {string} label
   * @param {string} message
   */
  #debug(label, message) {
    if (this.#options.loglevel.shouldDebug) {
      log(this.name, label, message);
    }
  }

  /**
   * The trace level includes granular messages about things that were skipped.
   *
   * @param {string} label
   * @param {string} message
   */
  #trace(label, message) {
    if (this.#options.loglevel.shouldTrace) {
      log(this.name, label, message);
    }
  }
}

/**
 * @param {'control' | 'experiment' | 'runner'} scenario
 * @param {string} label
 * @param {string} message
 */
function log(scenario, label, message) {
  console.debug(
    `${chalk.dim(`[${scenario}]`.padEnd('[experiment]'.length))} ${chalk.magenta.underline(
      label
    )} ${chalk.magenta.dim(message)}`
  );
}
