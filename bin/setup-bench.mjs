/* eslint-disable n/no-process-exit */
import 'zx/globals';

import { readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';

import { execa } from 'execa';

const ROOT = new URL('..', import.meta.url).pathname;
$.verbose = true;

const REUSE_CONTROL = !!(process.env['REUSE_DIRS'] || process.env['REUSE_CONTROL']);
const REUSE_EXPERIMENT = !!(process.env['REUSE_DIRS'] || process.env['REUSE_EXPERIMENT']);
const PREFER_OFFLINE = !!process.env['PREFER_OFFLINE'];

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

const tempDir = os.tmpdir();

const CONTROL_DIR = join(tempDir, 'control');
const EXPERIMENT_DIR = join(tempDir, 'experiment');

const CONTROL_BENCH_DIR = join(CONTROL_DIR, 'benchmark', 'benchmarks', 'krausest');
const EXPERIMENT_BENCH_DIR = join(EXPERIMENT_DIR, 'benchmark', 'benchmarks', 'krausest');

const pwdRaw = await $`pwd`;
const pwd = pwdRaw.toString().trim();

// we use benchmark from current commit, very useful if we need to tweak it
const benchmarkFolder = 'benchmark';

// remove node_modules from benchmark folder, maybe we could figure out better option to distribute bench source
await $`rm -rf ${join(pwd, benchmarkFolder, 'node_modules')}`;
await $`rm -rf ${join(pwd, benchmarkFolder, 'benchmarks', 'krausest', 'node_modules')}`;

if (!REUSE_CONTROL) {
  await $`rm -rf ${CONTROL_DIR}`;
  await $`mkdir ${CONTROL_DIR}`;
}

if (!REUSE_EXPERIMENT) {
  await $`rm -rf ${EXPERIMENT_DIR}`;
  await $`mkdir ${EXPERIMENT_DIR}`;
}

// Intentionally use the same folder for both experiment and control to make it easier to
// make changes to the benchmark suite itself and compare the results.
const BENCHMARK_FOLDER = join(pwd, benchmarkFolder);

const CONTROL_PORT = 4020;
const EXPERIMENT_PORT = 4021;
const CONTROL_URL = `http://localhost:${CONTROL_PORT}`;
const EXPERIMENT_URL = `http://localhost:${EXPERIMENT_PORT}`;

if (!PREFER_OFFLINE) {
  // make sure that the origin is up to date so we get the right control
  await $`git fetch origin`;
}

// now we can get the ref of the control branch so we can check it out later
const controlRef = (await $`git rev-parse origin/main`).stdout.trim();

// we can't do it in parallel on CI,

/**
 * Rewrite all `package.json`s with a `publishConfig` field with the fields specified in
 * `publishConfig`.
 */
async function rewritePackageJson() {
  // limit to `@glimmer/*` packages
  const packages = await $`find ./packages/@glimmer -name 'package.json'`;

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

console.info({
  control: controlBranchName,
  experiment: experimentRef,
  EXPERIMENT_DIR,
  CONTROL_DIR,
});

// setup control
await buildRepo(CONTROL_DIR, controlRef, REUSE_CONTROL);

// setup experiment
await buildRepo(EXPERIMENT_DIR, experimentRef, REUSE_EXPERIMENT);

// start build assets
const controlProcess = execa('pnpm', ['vite', 'preview', '--port', String(CONTROL_PORT)], {
  cwd: CONTROL_BENCH_DIR,
  stdio: 'inherit',
});

const experimentProcess = execa('pnpm', ['vite', 'preview', '--port', String(EXPERIMENT_PORT)], {
  cwd: EXPERIMENT_BENCH_DIR,
  stdio: 'inherit',
});

process.on('SIGINT', () => {
  controlProcess.kill();
  experimentProcess.kill();
});

await new Promise((resolve) => {
  // giving 5 seconds for the server to start
  setTimeout(resolve, 5000);
});

try {
  const output =
    await $`node --single-threaded-gc ./node_modules/tracerbench/bin/run compare --regressionThreshold 25 --sampleTimeout 60 --fidelity ${fidelity} --markers ${markers} --controlURL ${CONTROL_URL} --experimentURL ${EXPERIMENT_URL} --report --headless --cpuThrottleRate ${throttleRate}`;

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

/**
 * @param {string} directory the directory to clone into
 * @param {string} ref the ref to checkout
 * @param {boolean} reuse reuse the existing directory
 */
async function buildRepo(directory, ref, reuse) {
  if (!reuse) {
    await $`rm -rf ${directory}`;
    await $`mkdir ${directory}`;
  }

  await within(async () => {
    // the benchmark directory is located in `packages/@glimmer/benchmark` in each of the
    // experiment and control checkouts
    const benchDir = join(directory, 'benchmark', 'benchmarks', 'krausest');

    cd(directory);

    // write the `pwd` to the output to make it easier to debug if something goes wrong
    await $`pwd`;

    if (reuse) {
      await $`git fetch`;
    } else {
      // clone the raw git repo for the experiment
      await $`git clone ${join(ROOT, '.git')} .`;
    }

    // checkout the repo to the HEAD of the current branch
    await $`git checkout --force ${ref}`;

    // recreate the benchmark directory
    await $`rm -rf ./benchmark`;
    // intentionally use the same folder for both experiment and control
    await $`cp -r ${BENCHMARK_FOLDER} ./benchmark`;

    // `pnpm install` and build the repo
    await $`pnpm install --no-frozen-lockfile --color --no-strict-peer-dependencies ${
      PREFER_OFFLINE ? '--offline' : undefined
    }`;

    await $`pnpm build`;

    // rewrite all `package.json`s to behave like published packages
    await rewritePackageJson();

    // build the benchmarks using vite
    cd(benchDir);

    const tsconfig = JSON.parse(await readFile('tsconfig.json', { encoding: 'utf8' }));
    delete tsconfig['references'];
    await writeFile('tsconfig.json', JSON.stringify(tsconfig, null, 2), { encoding: 'utf8' });

    await $`pnpm vite build`;
  });
}
