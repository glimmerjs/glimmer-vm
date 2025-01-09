import os from 'node:os';

import { $ } from 'zx';

import { Cli } from './benchmark/cli.mjs';
import { BenchmarkRunner } from './benchmark/support.mjs';
import { getTestEnv } from './benchmark/test-env.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
$.verbose = true;

/**
 * @import { BuildMode, ServeMode } from './benchmark/types.d.ts';
 */

/** @satisfies {BuildMode[]} */
const BUILD_MODES = ['off', 'repeat', 'rebuild', 'reset'];

/** @satisfies {ServeMode[]} */
const SERVE_MODES = ['off', 'serve', 'bench'];

const cli = Cli(
  'pnpm benchmark:setup',
  { usage: '[options]', version: 'workspace:*' },
  {
    build: {
      type: 'string',
      description: 'The build mode for both scenarios (off, repeat, rebuild, reset)',
    },
    'experiment-build': {
      type: 'string',
      description: 'The build mode for the experiment scenario (off, repeat, rebuild, reset)',
    },
    'experiment-serve': {
      type: 'string',
      description: 'The serve mode for the experiment scenario (off, serve, bench)',
    },
    'control-build': {
      type: 'string',
      description: 'The build mode for the control scenario (off, repeat, rebuild, reset)',
    },
    'control-serve': {
      type: 'string',
      description: 'The serve mode for the control scenario (off, serve, bench)',
    },
    offline: {
      type: 'boolean',
      description: `Run the benchmark with local state (without fetching the repo or packages)`,
      default: false,
    },
  }
);

const parsed = cli.parse();

if (parsed.loglevel.shouldTrace) {
  console.table(
    Object.fromEntries(
      Object.entries(parsed.flags)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, value]) => [key, value])
    )
  );
}

/*

    To run proper bench setup we need to do following things:

    1.) Compile control packages
    2.) Compile experiment packages
    3.) Use SAME benchmark source
        * we should be able to tweak bench
          (add more cases, and still be able to compare with control)
        * we should be able to re-run bench in CI from current branch with updated perf source

  */

const buildMode = parsed.getEnumFlag('build', BUILD_MODES, { as: 'build mode' });

const runner = await BenchmarkRunner.initialize({
  env: getTestEnv(),
  workspaceRoot: ROOT,
  tmpdir: os.tmpdir(),
  control: {
    ref: process.env['CONTROL_BRANCH_NAME'] || 'main',
    build:
      parsed.getEnumFlag('control-build', BUILD_MODES, { as: 'build mode', for: 'control' }) ??
      buildMode ??
      'reset',
    serve:
      parsed.getEnumFlag('control-serve', SERVE_MODES, { as: 'serve mode', for: 'control' }) ??
      'bench',
    port: 4200,
  },
  experiment: {
    ref: process.env['EXPERIMENT_BRANCH_NAME'] || (await $`git rev-parse HEAD`).stdout.trim(),
    build:
      parsed.getEnumFlag('experiment-build', BUILD_MODES, {
        as: 'build mode',
        for: 'experiment',
      }) ??
      buildMode ??
      'reset',
    serve:
      parsed.getEnumFlag('experiment-serve', SERVE_MODES, {
        as: 'serve mode',
        for: 'experiment',
      }) ?? 'bench',
    port: 4201,
  },
  offline: parsed.flags.offline,
  loglevel: parsed.loglevel,
});

const { control, experiment } = runner.scenarios;

if (control) {
  await control.setupRepo();
  runner.serve(control);
}

if (experiment) {
  await experiment.setupRepo();
  runner.serve(experiment);
}

await new Promise((resolve) => {
  // giving 5 seconds for the server to start
  setTimeout(resolve, 5000);
});

await runner.bench();
