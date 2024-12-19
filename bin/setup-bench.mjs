/* eslint-disable n/no-process-exit */
import 'zx/globals';

import os from 'node:os';

import { peowly } from 'peowly';

import { Benchmark } from './benchmark/support.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
$.verbose = true;

/**
 * @import { Scenario } from './benchmark/support.mjs';
 */

/**
 * @typedef {{ run: false | 'reuse' | 'rebuild'; ref: string; port: number }} ScenarioConfig
 * @typedef {{ control: ScenarioConfig; experiment: ScenarioConfig; offline: boolean}} UserConfig
 * @typedef {{root: string}} WorkspaceOptions
 * @typedef {UserConfig & WorkspaceOptions} Options
 */

const NAME = 'setup-bench';

/**
 * @satisfies {import('peowly').AnyFlags}
 *
 */
const options = /** @type {const} */ ({
  reuse: {
    type: 'string',
    multiple: true,
    description: 'Reuse the existing /tmp directory for these scenarios',
    default: [],
  },
  'run-experiment': {
    type: 'string',
    description: 'How to run the experiment scenario (none, repeat, rebuild, reset)',
    default: 'reset',
  },
  'no-serve-experiment': {
    type: 'boolean',
    description: 'Set up the experiment scenario but do not serve it',
    default: false,
  },
  'run-control': {
    type: 'string',
    description: 'How to run the control scenario (none, repeat, rebuild, reset)',
    default: 'reset',
  },
  'no-serve-control': {
    type: 'boolean',
    description: 'Set up the control scenario but do not serve it',
    default: false,
  },
  offline: {
    type: 'boolean',
    description: `Run the benchmark with local state (without fetching the repo or packages)`,
    default: false,
  },
});

const cli = peowly({
  name: NAME,
  usage: '[options]',
  options,
});

console.dir({ cli }, { depth: null });

/*

    To run proper bench setup we need to do following things:

    1.) Compile control packages
    2.) Compile experiment packages
    3.) Use SAME benchmark source
        * we should be able to tweak bench
          (add more cases, and still be able to compare with control)
        * we should be able to re-run bench in CI from current branch with updated perf source

  */

const experimentRef =
  process.env['EXPERIMENT_BRANCH_NAME'] || (await $`git rev-parse HEAD`).stdout.trim();
const controlBranchName = process.env['CONTROL_BRANCH_NAME'] || 'main';

// same order as in benchmark/benchmarks/krausest/lib/index.ts
const appMarkers = [
  'render',
  'render1000Items1',
  'clearItems1',
  'render1000Items2',
  'clearItems2',
  'render5000Items1',
  'clearManyItems1',
  'render5000Items2',
  'clearManyItems2',
  'render1000Items3',
  'append1000Items1',
  'append1000Items2',
  'updateEvery10thItem1',
  'updateEvery10thItem2',
  'selectFirstRow1',
  'selectSecondRow1',
  'removeFirstRow1',
  'removeSecondRow1',
  'swapRows1',
  'swapRows2',
  'clearItems4',
].reduce((acc, marker) => {
  return acc + ',' + marker + 'Start,' + marker + 'End';
}, '');
const markers = (process.env['MARKERS'] || appMarkers)
  .split(',')
  .filter((el) => el.length)
  .join(',');
const fidelity = process.env['FIDELITY'] || '20';
const throttleRate = process.env['THROTTLE'] || '2';

const BENCHMARK = await Benchmark.initialize({
  workspaceRoot: ROOT,
  tmpdir: os.tmpdir(),
  control: {
    ref: controlBranchName,
    run: getRun('control'),
    serve: !cli.flags['no-serve-control'],
    port: 4200,
  },
  experiment: {
    ref: experimentRef,
    run: getRun('experiment'),
    serve: !cli.flags['no-serve-experiment'],
    port: 4201,
  },
  offline: cli.flags.offline,
});

/**
 * @param {'control' | 'experiment'} scenario
 * @returns {false | 'repeat' | 'rebuild' | 'reset'}
 */
function getRun(scenario) {
  const run = cli.flags[`run-${scenario}`];
  return run === 'none' ? false : run;
}

// we can't do it in parallel on CI,

console.info({
  control: controlBranchName,
  experiment: experimentRef,
  benchmark: BENCHMARK,
});

/** @type {Partial<Record<'control' | 'experiment', import('execa').ExecaChildProcess<string>>>} */
const PROCESSES = {};

const { control, experiment } = BENCHMARK.scenarios;

if (control) {
  await setupRepo(control);
  const controlProcess = control.serve();

  if (controlProcess) {
    PROCESSES.control = controlProcess;
  }
}

if (experiment) {
  await setupRepo(experiment);
  const experimentProcess = experiment.serve();

  if (experimentProcess) {
    PROCESSES.experiment = experimentProcess;
  }
}

process.on('SIGINT', () => {
  for (const process of Object.values(PROCESSES)) {
    process.kill();
  }
});

await new Promise((resolve) => {
  // giving 5 seconds for the server to start
  setTimeout(resolve, 5000);
});

if (control && experiment) {
  try {
    const output =
      await $`node --single-threaded-gc ./node_modules/tracerbench/bin/run compare --regressionThreshold 25 --sampleTimeout 60 --fidelity ${fidelity} --markers ${markers} --controlURL ${control.url} --experimentURL ${experiment.url} --report --headless --cpuThrottleRate ${throttleRate}`;

    fs.ensureDirSync('tracerbench-results');
    fs.writeFileSync(
      'tracerbench-results/msg.txt',
      output.stdout.split('Benchmark Results Summary').pop() ?? ''
    );
  } catch (p) {
    console.error(p);
    process.exit(1);
  }

  process.exit(0);
}

/**
 * @param {Scenario} scenario the scenario to set up
 * @returns {Promise<void>}
 */
async function setupRepo(scenario) {
  await scenario.reset();
  await scenario.report();
  await scenario.clone();
  await scenario.setupBenchmarks();
  await scenario.pnpmInstall();
  await scenario.pnpmBuild();
  await scenario.viteBuild();
}
