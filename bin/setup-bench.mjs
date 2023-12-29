// @ts-nocheck
import 'zx/globals';
import os from 'node:os';
import { join } from 'node:path';

/*

  To run proper bench setup we need to do following things:

  1.) Compile control packages
  2.) Compile experiment packages
  3.) Use SAME benchmark source
      * we should be able to tweak bench
        (add more cases, and still be able to compare with control)
      * we should be able to re-run bench in CI from current branch with updated perf source

*/

const experimentBranchName =
  process.env['EXPERIMENT_BRANCH_NAME'] || (await $`git rev-parse --abbrev-ref HEAD`).stdout.trim();
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

const pwd = process.cwd();

// we use benchmark from current commit, very useful if we need to tweak it
const benchmarkFolder = 'benchmark';
const krausest = 'benchmark/benchmarks/krausest';

// remove node_modules from benchmark folder, maybe we could figure out better option to distribute bench source
await $`rm -rf ${join(pwd, benchmarkFolder, 'node_modules')}`;
await $`rm -rf ${join(pwd, benchmarkFolder, 'benchmarks/krausest/node_modules')}`;

await $`rm -rf ${CONTROL_DIR}`;
await $`rm -rf ${EXPERIMENT_DIR}`;
await $`mkdir ${CONTROL_DIR}`;
await $`mkdir ${EXPERIMENT_DIR}`;

const BENCHMARK_FOLDER = join(pwd, benchmarkFolder);
const BIN_FOLDER = join(pwd, 'bin');
const WORKSPACE_FOLDER = join(pwd, 'packages/@glimmer-workspace');

const rawUpstreamUrl = await $`git ls-remote --get-url upstream`;
const rawOriginUrl = await $`git ls-remote --get-url origin`;
let originUrlStr = rawOriginUrl.toString().trim();
let upstreamUrlStr = rawUpstreamUrl.toString().trim();

if (upstreamUrlStr === 'upstream') {
  // if we not inside fork, falling back to origin
  upstreamUrlStr = originUrlStr;
}

if (FORK_NAME && FORK_NAME !== 'glimmerjs/glimmer-vm') {
  // if PR from fork, we need to resolve fork's commit
  originUrlStr = originUrlStr.replace('glimmerjs/glimmer-vm', FORK_NAME);
}

const CONTROL_PORT = 4020;
const EXPERIMENT_PORT = 4021;
const CONTROL_URL = `http://localhost:${CONTROL_PORT}`;
const EXPERIMENT_URL = `http://localhost:${EXPERIMENT_PORT}`;

// we can't do it in parallel on CI,

/**
 * Setup the experiment / control with the exact same
 * - benchmark folder
 * - bin folder
 *
 * (as what is on the experiment branch)
 */
async function setup({ targetDir, remoteUrl, branchName, label }) {
  await within(async () => {
    cd(targetDir);

    await $`git clone ${remoteUrl} .`;
    await $`git checkout ${branchName}`;
    await $`rm -rf ./bin`;
    await $`cp -r ${BIN_FOLDER} ${targetDir}/bin`;

    console.info(`installing ${label} source`);
    await $`pnpm install --no-frozen-lockfile`.quiet();
    console.info(`building ${label} source, may take a while`);
    await $`pnpm build`.quiet();
    await $`pnpm esyes ${targetDir}/bin/preview-publish.mts`;

    cd(join(targetDir, 'dist'));

    await $`mkdir -p ${targetDir}/dist/@glimmer-workspace/`;
    await $`cp -r ${BENCHMARK_FOLDER} ${targetDir}/dist/benchmark`;
    await $`cp -r ${WORKSPACE_FOLDER}/benchmark-env ${targetDir}/dist/@glimmer-workspace/benchmark-env`;
    await $`echo "  - '@glimmer-workspace/*'" >> pnpm-workspace.yaml`;
    await $`echo "  - 'benchmark'" >> pnpm-workspace.yaml`;
    await $`echo "  - 'benchmark/benchmarks/krausest'" >> pnpm-workspace.yaml`;
    await $`cd ${targetDir}/dist && pnpm install --no-frozen-lockfile`;

    cd(join(targetDir, 'dist', krausest));

    await fs.writeFile(
      join(targetDir, 'dist', krausest, 'tsconfig.json'),
      `
        {
          "compilerOptions": {
            "composite": true,
            "strict": true,
            "baseUrl": ".",
            "allowJs": true,
            "checkJs": true,

            "target": "es2020",
            "module": "esnext",
            "moduleResolution": "bundler",
            "verbatimModuleSyntax": true,
            "noErrorTruncation": true,

            "suppressImplicitAnyIndexErrors": false,
            "useDefineForClassFields": false,
            "exactOptionalPropertyTypes": true,
            "noImplicitOverride": true,
            "noPropertyAccessFromIndexSignature": true,
            "noUncheckedIndexedAccess": true,
            "skipLibCheck": true,
            "noEmit": true,
            "paths": {
              "@/components/*": ["./lib/components/*"],
              "@/utils/*": ["./lib/utils/*"],
              "@glimmer-workspace/benchmark-env": ["../../../@glimmer-workspace/benchmark-env"],
              "@glimmer/runtime": ["../../../@glimmer/runtime"]
            }
          },
          "include": ["./lib/", "./browser.js"],
        }
    `
    );
    await $`pnpm vite build`;
  });
}

await setup({
  label: 'experiment',
  targetDir: EXPERIMENT_DIR,
  remoteUrl: originUrlStr,
  branchName: experimentBranchName,
});

await setup({
  label: 'control',
  targetDir: CONTROL_DIR,
  remoteUrl: upstreamUrlStr,
  branchName: controlBranchName,
});

console.info({
  control: {
    upstreamUrlStr,
    controlBranchName,
    CONTROL_DIR,
    CONTROL_PORT,
    CONTROL_URL,
  },
  experiment: {
    originUrlStr,
    experimentBranchName,
    EXPERIMENT_DIR,
    EXPERIMENT_PORT,
    EXPERIMENT_URL,
  },
});

// start build assets
$`cd ${join(CONTROL_DIR, 'dist', krausest)} && pnpm vite preview --port ${CONTROL_PORT}`;
$`cd ${join(EXPERIMENT_DIR, 'dist', krausest)} && pnpm vite preview --port ${EXPERIMENT_PORT}`;

await new Promise((resolve) => {
  // giving 5 seconds for the server to start
  setTimeout(resolve, 5000);
});

try {
  const output =
    await $`./node_modules/.bin/tracerbench compare --regressionThreshold 25 --sampleTimeout 60 --fidelity ${fidelity} --markers ${markers} --controlURL ${CONTROL_URL} --experimentURL ${EXPERIMENT_URL} --report --headless --cpuThrottleRate ${throttleRate}`;

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
