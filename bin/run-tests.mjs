// @ts-check

import child from 'child_process';
import { resolve } from 'path';
import PCR from 'puppeteer-chromium-resolver';
import stripAnsi from 'strip-ansi';
import { fileURLToPath } from 'url';

const { puppeteer, executablePath } = await PCR({});

const __root = fileURLToPath(new URL('..', import.meta.url));

const qps = getQPs();
const check = process.argv.includes('--check');
const failingOnly = process.argv.includes('--failing-only') || check;
const traceHarness = process.argv.includes('--trace-harness');

function getQPs() {
  let params = [];
  const args = process.argv.slice(2);

  for (const arg of args) {
    const qp = getQP(arg);
    if (qp) {
      params.push(qp);
    }
  }
  return params.join('&');
}

/**
 * @param {string | undefined} filter
 * @returns {string[] | undefined}
 */
function getQP(filter) {
  if (!filter) {
    return undefined;
  }

  switch (filter) {
    case '--headless':
    case '--failing-only':
    case '--ci':
    case '--check':
    case '--trace-harness':
      return [];
  }

  if (filter === '--enable-trace-logging') {
    return ['enable_trace_logging'];
  } else if (filter === '--enable-subtle-logging') {
    return ['enable_subtle_logging'];
  } else if (filter.startsWith(`--filter=`)) {
    return [`filter=${encodeURIComponent(filter.slice('--filter='.length))}`];
  } else if (filter.startsWith(`--ids=`)) {
    const ids = filter
      .slice('--ids='.length)
      .split(',')
      .map((id) => id.trim());
    return ids.map((id) => `testId=${encodeURIComponent(id)}`);
  } else if (filter.startsWith(`--query=`)) {
    const query = filter.slice('--query='.length);
    return [`${query}`];
  } else {
    console.error(`Unknown parameter format: ${filter}`);
    process.exit(1);
  }
}

stderr('[ci] starting');

const port = await /** @type {Promise<string>} */ (
  new Promise((fulfill, reject) => {
    const runvite = child.fork(
      resolve(__root, 'node_modules', 'vite', 'bin', 'vite.js'),
      ['--port', '60173', '--no-open'],
      {
        stdio: 'pipe',
      }
    );

    // Add timeout for Vite startup
    const timeout = setTimeout(() => {
      runvite.kill();
      reject(new Error('Vite failed to start within 30 seconds'));
    }, 30000);

    process.on('exit', () => runvite.kill());

    // Buffer to accumulate output in case it comes in chunks
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let portFound = false;

    runvite.stderr?.on('data', (data) => {
      const chunk = String(data);
      trace('stderr', chunk);
      
      // Once port is found, no need to process further
      if (portFound) return;
      
      stderrBuffer += chunk;

      // Check accumulated buffer for the port
      const cleanBuffer = stripAnsi(stderrBuffer);
      // More flexible regex that handles Vite's arrow prefix and whitespace
      const port = /https?:\/\/localhost:(\d+)/u.exec(cleanBuffer)?.[1];
      if (port) {
        trace('Port detected in stderr:', port);
        portFound = true;
        clearTimeout(timeout);
        fulfill(port);
      }
    });

    runvite.stdout?.on('data', (data) => {
      const chunk = String(data);
      
      if (!check) {
        stderr(chunk);
      }
      
      // Once port is found, no need to buffer or process further
      if (portFound) return;
      
      stdoutBuffer += chunk;

      const cleanChunk = stripAnsi(chunk);
      const cleanBuffer = stripAnsi(stdoutBuffer);

      trace('Vite stdout chunk:', JSON.stringify(chunk));
      trace('Clean chunk:', JSON.stringify(cleanChunk));
      trace('Accumulated buffer:', JSON.stringify(cleanBuffer));

      // Check accumulated buffer for the port
      // More flexible regex that handles Vite's arrow prefix and whitespace
      const port = /https?:\/\/localhost:(\d+)/u.exec(cleanBuffer)?.[1];

      if (port) {
        trace('Port detected:', port);
        portFound = true;
        clearTimeout(timeout);
        fulfill(port);
      }
    });

    stderr('[ci] spawning');
  })
);

stderr('[ci] spawned');

const browser = await puppeteer.launch({
  headless: true,
  executablePath,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-software-rasterizer',
  ],
});

stderr('[ci] puppeteer launched');

/**
 * @typedef {{passed: boolean; message?: string; expected: unknown; actual: unknown; stack?: string}} FailedAssertion
 * @typedef {{ testCounts: { total: number }}} RunStart
 * @typedef {{ status: 'passed' | 'failed'; runtime: number; testCounts: { total: number; failed: number; passed: number; skipped: number; todo: number }}} RunEnd
 * @typedef {{ fullName: string[] }} SuiteStart
 * @typedef {{ fullName: string[]; runtime: string; status: 'passed' | 'failed'}} SuiteEnd
 * @typedef {{name: string; suiteName: string; fullName: string[]}} TestStart
 * @typedef {TestStart & {runtime: string; status: 'passed' | 'failed' | 'skipped' | 'todo'; errors:
 * FailedAssertion[]}} TestEnd
 */

/**
 * @param {string} type
 * @param {...unknown} args
 */
function other(type, ...args) {
  if (!failingOnly) {
    if (args.length === 1) {
      const [arg] = args;
      if (typeof arg === 'string' && !arg.includes('\n')) {
        console.error(`# [${type.toUpperCase()}] ${arg}`);
        return;
      } else if ((typeof arg !== 'object' && typeof arg !== 'string') || arg === null) {
        console.error(`# [${type.toUpperCase()}] ${JSON.stringify(arg)}`);
        return;
      }
    }

    console.error(`# [${type.toUpperCase()}]`);

    for (const arg of args) {
      if (typeof arg === 'string') {
        const lines = arg.split('\n');
        for (const line of lines) {
          if (line) {
            console.error(`# > ${line}`);
          }
        }
      } else {
        console.error(`# > `, arg);
      }
    }
  }
}

try {
  stderr('[ci] navigating to new page');
  const page = await browser.newPage();

  /**
   * @param {string} message
   */
  function ciLog(message) {
    if (message.startsWith('ok ') && failingOnly) {
      return;
    }

    console.log(message);
  }

  /**
   * @param {['end', { passed: number; failed: number; total: number; runtime: number }]} args
   */
  function harnessEvent(...args) {
    const [, counts] = args;
    process.exit(counts.failed > 0 ? 1 : 0);
  }

  await page.exposeFunction('exposedCiLog', ciLog);
  await page.exposeFunction('ciHarnessEvent', harnessEvent);

  stderr('[ci] done navigating');

  stderr('[ci] waiting for console');

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  page.on('console', async (msg) => {
    const [first, ...rest] = await Promise.all(msg.args().map((arg) => arg.jsonValue()));

    if (typeof first === 'string') {
      return;
    }

    other(msg.type(), first, ...rest);
  });

  const { promise } = Promise.withResolvers();

  stderr('[ci] done waiting');

  stderr('[ci] navigating to test page');
  const url = `http://localhost:${port}?hidepassed&ci&${qps}`;
  void page.goto(url);
  stderr('[ci] done navigating');
  await promise;
} catch {
  await browser.close();
  process.exit(1);
}

await browser.close();

process.exit(0);

/**
 * @param {string} msg
 * @param {...unknown[]} args
 */
function stderr(msg, ...args) {
  if (!failingOnly) {
    console.error(msg, ...args);
  }
}

/**
 * @param {string} msg
 * @param {...unknown} args
 */
function trace(msg, ...args) {
  if (traceHarness) {
    console.error(`[TRACE]`, msg, ...args);
  }
}
