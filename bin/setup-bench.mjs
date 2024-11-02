import 'zx/globals';
import os from 'node:os';
import { join } from 'node:path';
import chalk from 'chalk';

const ROOT = new URL('..', import.meta.url).pathname;
$.verbose = true;
const REUSE_CONTROL = !!process.env['REUSE_CONTROL'];

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
const FORK_NAME = process.env['FORK_NAME'] || '';

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

await $`rm -rf ${EXPERIMENT_DIR}`;
await $`mkdir ${EXPERIMENT_DIR}`;

const isMacOs = os.platform() === 'darwin';

const BENCHMARK_FOLDER = join(pwd, benchmarkFolder);

const CONTROL_PORT = 4020;
const EXPERIMENT_PORT = 4021;
const CONTROL_URL = `http://localhost:${CONTROL_PORT}`;
const EXPERIMENT_URL = `http://localhost:${EXPERIMENT_PORT}`;

// we can't do it in parallel on CI,

if (!REUSE_CONTROL) {
  // setup control
  await within(async () => {
    await $`git fetch origin`;
    const mainRef = await $`git rev-parse origin/main`;
    await cd(CONTROL_DIR);
    await $`git clone ${join(ROOT, '.git')} .`;
    await $`git reset --hard ${mainRef}`;
    await $`rm -rf ./benchmark`;
    await $`cp -r ${BENCHMARK_FOLDER} ./benchmark`;

    console.info(`$ pnpm install --no-frozen-lockfile ${chalk.gray('[control]')}`);

    await $`pwd`;
    const result = await $`pnpm install`;
    console.log(result);

    console.info(`$ pnpm build ${chalk.gray('[control]')}`);

    await $`pnpm build`;

    if (isMacOs) {
      await $`find ./packages -name 'package.json' -exec sed -i '' 's|"main": "index.ts",|"main": "./dist/prod/index.js","module": "./dist/prod/index.js",|g' {} \\;`;
      await $`find ./packages -name 'package.json' -exec sed -i '' 's|"main": "./dist/index.js",|"main": "./dist/prod/index.js","module": "./dist/prod/index.js",|g' {} \\;`;
      await $`find ./packages -name 'package.json' -exec sed -i '' 's|"import": "./dist/index.js"|"import": "./dist/prod/index.js"|g' {} \\;`;
    } else {
      await $`find ./packages -name 'package.json' -exec sed -i 's|"main": "index.ts",|"main": "./dist/prod/index.js","module": "./dist/prod/index.js",|g' {} \\;`;
      await $`find ./packages -name 'package.json' -exec sed -i 's|"main": "./dist/index.js",|"main": "./dist/prod/index.js","module": "./dist/prod/index.js",|g' {} \\;`;
      await $`find ./packages -name 'package.json' -exec sed -i 's|"import": "./dist/index.js"|"import": "./dist/prod/index.js"|g' {} \\;`;
    }

    await cd(CONTROL_BENCH_DIR);
    await $`pnpm vite build`;
  });
}

// setup experiment
await within(async () => {
  await cd(EXPERIMENT_DIR);
  await $`git clone ${join(ROOT, '.git')} .`;
  await $`git checkout --force ${experimentRef}`;
  await $`rm -rf ./benchmark`;
  await $`cp -r ${BENCHMARK_FOLDER} ./benchmark`;

  console.info(`$ pnpm install --no-frozen-lockfile ${chalk.gray('[experiment]')}`);
  const install = () => $`pnpm install --no-frozen-lockfile`.pipe(process.stderr);
  await spinner(install);
  console.info(`$ pnpm build ${chalk.gray('[experiment]')}`);
  const build = () => $`pnpm build`.pipe(process.stderr);
  await spinner(build);

  if (isMacOs) {
    await $`find ./packages -name 'package.json' -exec sed -i '' 's|"main": "index.ts",|"main": "./dist/prod/index.js","module": "./dist/prod/index.js",|g' {} \\;`;
    await $`find ./packages -name 'package.json' -exec sed -i '' 's|"main": "./dist/index.js",|"main": "./dist/prod/index.js","module": "./dist/prod/index.js",|g' {} \\;`;
    await $`find ./packages -name 'package.json' -exec sed -i '' 's|"import": "./dist/index.js"|"import": "./dist/prod/index.js"|g' {} \\;`;
  } else {
    await $`find ./packages -name 'package.json' -exec sed -i 's|"main": "index.ts",|"main": "./dist/prod/index.js","module": "./dist/prod/index.js",|g' {} \\;`;
    await $`find ./packages -name 'package.json' -exec sed -i 's|"main": "./dist/index.js",|"main": "./dist/prod/index.js","module": "./dist/prod/index.js",|g' {} \\;`;
    await $`find ./packages -name 'package.json' -exec sed -i 's|"import": "./dist/index.js"|"import": "./dist/prod/index.js"|g' {} \\;`;
  }

  await cd(EXPERIMENT_BENCH_DIR);
  await $`pnpm vite build`;
});

console.info({
  control: controlBranchName,
  experiment: experimentRef,
  EXPERIMENT_DIR,
  CONTROL_DIR,
});

// start build assets
$`cd ${CONTROL_BENCH_DIR} && pnpm vite preview --port ${CONTROL_PORT}`;
$`cd ${EXPERIMENT_BENCH_DIR} && pnpm vite preview --port ${EXPERIMENT_PORT}`;

await new Promise((resolve) => {
  // giving 5 seconds for the server to start
  setTimeout(resolve, 5000);
});

try {
  const output =
    await $`node --single-threaded-gc ./node_modules/tracerbench/bin/run compare --regressionThreshold 25 --sampleTimeout 60 --fidelity ${fidelity} --markers ${markers} --controlURL ${CONTROL_URL} --experimentURL ${EXPERIMENT_URL} --report --headless --cpuThrottleRate ${throttleRate}`;

  try {
    fs.writeFileSync(
      'tracerbench-results/msg.txt',
      output.stdout.split('Benchmark Results Summary').pop() ?? ''
    );
  } catch (e) {
    // fine
  }
} catch (p) {
  console.error(p);
  process.exit(1);
}

process.exit(0);
