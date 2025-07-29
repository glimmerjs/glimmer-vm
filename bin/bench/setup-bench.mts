import os from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

import { WORKSPACE_ROOT } from '@glimmer-workspace/repo-metadata';
import chalk from 'chalk';
import fs from 'fs-extra';
import { $, which } from 'zx';

import { buildKrausestDeps } from './bench-packages.mts';
import type { ServerInfo } from '../browser/browser-utils-playwright.mts';

const { ensureDirSync, writeFileSync } = fs;

const ROOT = new URL('..', import.meta.url).pathname;
$.verbose = true;

/**
 * By default, we rebuild the control branch every time. The `REUSE_CONTROL` env var
 * can be used to reuse the checked out control branch.
 */
const FRESH_CONTROL_CHECKOUT = !process.env['REUSE_CONTROL'];
const FRESH_EXPERIMENT_CHECKOUT = !process.env['REUSE_EXPERIMENT'];

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

const CONTROL_DIRS = {
  root: join(tempDir, 'control'),
  repo: join(tempDir, 'control/repo'),
  bench: join(tempDir, 'control/bench'),
};
const EXPERIMENT_DIRS = {
  root: join(tempDir, 'experiment'),
  bench: join(tempDir, 'experiment/bench'),
  src: join(WORKSPACE_ROOT, 'benchmark/benchmarks/krausest'),
};

const CONTROL_PORT = 4020;
const EXPERIMENT_PORT = 4021;
const CONTROL_URL = `http://localhost:${CONTROL_PORT}`;
const EXPERIMENT_URL = `http://localhost:${EXPERIMENT_PORT}`;

const pnpm = await which('pnpm');

// Check if benchmark packages exist
const packagesDir = join(EXPERIMENT_DIRS.src, 'packages');
if (!fs.existsSync(packagesDir) || fs.readdirSync(packagesDir).length === 0) {
  console.error(chalk.red('\nError: Benchmark packages not found!'));
  console.error(chalk.yellow('\nPlease run: pnpm benchmark:setup'));
  console.error(chalk.gray('\nThis will build the necessary package tarballs for benchmarking.\n'));
  process.exit(1);
}

// set up experiment
{
  if (FRESH_EXPERIMENT_CHECKOUT) {
    await $`rm -rf ${EXPERIMENT_DIRS.root}`;
    await $`mkdir -p ${EXPERIMENT_DIRS.bench}`;
    await $`cp -r ${EXPERIMENT_DIRS.src}/* ${EXPERIMENT_DIRS.bench}/`;
    await $`${pnpm} turbo prepack --output-logs=new-only`;
    await buildKrausestDeps({
      roots: { benchmark: EXPERIMENT_DIRS.bench, workspace: WORKSPACE_ROOT },
    });
    await $`rm -rf ${EXPERIMENT_DIRS.bench}/node_modules`;
    await $({ cwd: EXPERIMENT_DIRS.bench })`${pnpm} install`;
    await $({ cwd: EXPERIMENT_DIRS.bench })`${pnpm} vite build`;
  }
}

// make sure that the origin is up to date so we get the right control
await $`git fetch origin`;

// now we can get the ref of the control branch so we can check it out later
const controlRef = (await $`git rev-parse origin/main`).stdout.trim();

console.info({
  control: controlBranchName,
  experiment: experimentRef,
  EXPERIMENT_DIRS,
  CONTROL_DIRS,
});

// set up control
{
  if (FRESH_CONTROL_CHECKOUT) {
    // A fresh checkout will reset the control directory and re-clone the repo from scratch at the
    // control ref (i.e. `main`).
    await $`rm -rf ${CONTROL_DIRS.root}`;
    await $`mkdir -p ${CONTROL_DIRS.bench}`;

    // clone the raw git repo for the experiment
    await $`git clone ${join(ROOT, '.git')} ${CONTROL_DIRS.repo}`;
  } else {
    // When reusing the control checkout, we just need to make sure the repo is up to date.
    await $({ cwd: CONTROL_DIRS.repo })`git fetch`;
  }

  // Update the checkout to the control ref.
  await $({ cwd: CONTROL_DIRS.repo })`git checkout --force ${controlRef}`;

  await $`rm -rf ${CONTROL_DIRS.bench}`;
  // Intentionally use the `krausest` folder from the experiment in both
  // control and experiment
  await $`mkdir -p ${CONTROL_DIRS.bench}`;
  await $`cp -r ${EXPERIMENT_DIRS.src}/* ${CONTROL_DIRS.bench}/`;

  await $({ cwd: CONTROL_DIRS.repo })`${pnpm} install`;
  await $({ cwd: CONTROL_DIRS.repo })`${pnpm} turbo prepack --output-logs=new-only`;

  await buildKrausestDeps({
    roots: { benchmark: CONTROL_DIRS.bench, workspace: CONTROL_DIRS.repo },
  });

  await $`rm -rf ${CONTROL_DIRS.bench}/node_modules`;
  await $({ cwd: CONTROL_DIRS.bench })`${pnpm} install`;
  await $({ cwd: CONTROL_DIRS.bench })`${pnpm} vite build`;
}

// Start benchmark servers
async function startBenchmarkServer(cwd: string, port: number): Promise<ServerInfo> {
  return new Promise((resolve, reject) => {
    const viteProcess = spawn('pnpm', ['vite', 'preview', '--port', port.toString()], {
      cwd,
      shell: true,
    });

    const timeoutId = setTimeout(() => {
      viteProcess.kill();
      reject(new Error(`Vite server failed to start on port ${port}`));
    }, 30000);

    let serverStarted = false;

    viteProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      if (output.includes(`http://localhost:${port}`) && !serverStarted) {
        serverStarted = true;
        clearTimeout(timeoutId);
        resolve({
          port,
          cleanup: () => viteProcess.kill(),
        });
      }
    });

    viteProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      if (output.includes(`http://localhost:${port}`) && !serverStarted) {
        serverStarted = true;
        clearTimeout(timeoutId);
        resolve({
          port,
          cleanup: () => viteProcess.kill(),
        });
      }
    });

    viteProcess.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });

    viteProcess.on('exit', (code) => {
      if (!serverStarted) {
        clearTimeout(timeoutId);
        reject(new Error(`Vite exited with code ${code}`));
      }
    });
  });
}

const controlServer = await startBenchmarkServer(CONTROL_DIRS.bench, CONTROL_PORT);
const experimentServer = await startBenchmarkServer(EXPERIMENT_DIRS.bench, EXPERIMENT_PORT);

process.on('exit', () => {
  controlServer.cleanup();
  experimentServer.cleanup();
});

console.log(chalk.green(`Control server started on port ${CONTROL_PORT}`));
console.log(chalk.green(`Experiment server started on port ${EXPERIMENT_PORT}`));

try {
  const output =
    await $`node --single-threaded-gc ./node_modules/tracerbench/bin/run compare --regressionThreshold 25 --sampleTimeout 60 --fidelity ${fidelity} --markers ${markers} --controlURL ${CONTROL_URL} --experimentURL ${EXPERIMENT_URL} --report --headless --cpuThrottleRate ${throttleRate}`;

  ensureDirSync('tracerbench-results');
  writeFileSync(
    'tracerbench-results/msg.txt',
    output.stdout.split('Benchmark Results Summary').pop() ?? ''
  );
} catch (p) {
  console.error(p);
  process.exit(1);
} finally {
  controlServer.cleanup();
  experimentServer.cleanup();
}

