#!/usr/bin/env node --disable-warning=ExperimentalWarning --experimental-strip-types

import { resolve } from 'node:path';

import type { Page } from 'playwright';
import { Command, Option } from '@commander-js/extra-typings';

import {
  exposeFunctions,
  setupBrowser,
  startViteServer,
} from '../browser/browser-utils-playwright.mts';
import { buildQueryParams } from './query-params.ts';

const __root = resolve(import.meta.dirname, '../..');

interface TestCounts {
  passed: number;
  failed: number;
  total: number;
  runtime: number;
}

type TraceType = 'harness' | 'network' | 'network-errors' | 'vite' | '*';

// Create the command-line interface
const command = new Command()
  .name('run-tests-playwright')
  .description('Run Glimmer VM tests using Playwright')
  .version('1.0.0')
  .addOption(
    new Option('-b, --browser <browser>', 'browser to use')
      .choices(['chromium', 'firefox', 'webkit'])
      .default('chromium')
  )
  .option('--headed', 'run tests in headed mode (show browser)', false)
  .option('--ci', 'run in CI mode (headless, video recording)', false)
  .option('--check', 'run in check mode (headless, failing tests only)', false)
  .option('--failing-only', 'only show failing tests', false)
  .option('-f, --filter <pattern>', 'filter tests by pattern')
  .option('--ids <ids>', 'run specific test IDs (comma-separated)')
  .option('-q, --query <query>', 'custom query parameters')
  .option('--enable-trace-logging', 'enable trace logging in tests', false)
  .option('--enable-subtle-logging', 'enable subtle logging in tests', false)
  .option('-t, --timeout <seconds>', 'test timeout in seconds', (value) => parseInt(value, 10), 300)
  .option('--screenshot <path>', 'capture screenshot on completion')
  .option('--video <dir>', 'record video to directory')
  .addOption(
    new Option('--trace-harness <types...>', 'enable trace logs')
      .choices(['harness', 'network', 'vite', 'network-errors', '*'])
      .default([] as TraceType[])
  )
  .action(async (options) => {
    const runner = new TestRunner(options);

    // Determine headless mode
    const headless = !options.headed && (options.ci || options.check || !!process.env['CI']);
    const failingOnly = options.failingOnly || options.check;

    // Build query parameters
    const queryParams = runner.buildQueryParams();

    runner.trace('harness', 'starting', { headless, failingOnly });
    runner.trace('harness', `Running in ${headless ? 'headless' : 'headed'} mode`);
    runner.trace('harness', `Browser: ${options.browser}`);

    try {
      // Start Vite server
      const { page, port } = await runner.launch();
      const url = `http://localhost:${port}?hidepassed&ci&${queryParams}`;

      await page.exposeFunctions();
      await page.initialize();
      await page.navigate(url);
      await page.screenshot();
      await page.dispose();
    } catch (error) {
      console.error('[Error]', error);
      process.exit(1);
    }
  });

export type InferOptions<T extends Command> =
  T extends Command<any, infer Options, any> ? Options : never;
export type CommandOptions = InferOptions<typeof command>;

function browserConsoleTapComment(type: string, ...args: unknown[]): void {
  const [first, ...rest] = args;

  if (rest.length === 0 && typeof first !== 'boolean') {
    const arg = first;
    if (typeof arg === 'string' && !arg.includes('\n')) {
      console.error(`# [${type.toUpperCase()}] ${arg}`);
      return;
    } else if ((typeof arg !== 'object' && typeof arg !== 'string') || arg === null) {
      console.error(`# [${type.toUpperCase()}] ${JSON.stringify(arg)}`);
      return;
    }
  }

  console.error(`# [${type.toUpperCase()}]`);

  for (const arg of rest) {
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

interface Destroy {
  dispose: () => Promise<void>;
  cleanup: () => void;
}

class TestPage {
  readonly #runner: TestRunner;
  readonly #page: Page;
  readonly #destroy: Destroy;

  constructor(runner: TestRunner, page: Page, destroy: Destroy) {
    this.#runner = runner;
    this.#page = page;
    this.#destroy = destroy;

    page.on('console', async (msg: any) => {
      const args = await Promise.all(
        msg.args().map((arg: any) => arg.jsonValue().catch(() => arg.toString()))
      );

      const [first, ...rest] = args;

      if (typeof first === 'string') {
        return;
      }

      if (!runner.failingOnly) {
        browserConsoleTapComment(msg.type(), first, ...rest);
      }
    });

    // Error handling
    page.on('pageerror', (error: Error) => {
      console.error('[Page Error]', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
    });

    if (runner.traces('network-errors') || !runner.failingOnly) {
      // Network request failures
      page.on('requestfailed', (request: any) => {
        const failure = request.failure();
        console.error(
          `[Network] Failed: ${request.method()} ${request.url()} - ${failure?.errorText}`
        );
      });
    }

    // Trace logging
    if (runner.traces('network')) {
      page.on('request', (request) => {
        runner.trace('network', `[Request] ${request.method()} ${request.url()}`);
      });

      page.on('response', (response) => {
        runner.trace('network', `[Response] ${response.status()} ${response.url()}`);
      });
    }
  }

  async dispose() {
    await this.#destroy.dispose();
  }

  async exposeFunctions() {
    const runner = this.#runner;
    const destroy = this.#destroy;

    // Set up test harness functions
    function ciLog(message: string): void {
      if (message.startsWith('ok ') && runner.failingOnly) {
        return;
      }
      console.log(message);
    }

    function harnessEvent(_eventType: 'end', counts: TestCounts): void {
      destroy.cleanup();
      process.exit(counts.failed > 0 ? 1 : 0);
    }

    // Expose functions to page
    await exposeFunctions(this.#page, {
      exposedCiLog: ciLog,
      ciHarnessEvent: harnessEvent,
    });
  }

  async initialize() {
    // Inject completion handler
    await this.#page.addInitScript(() => {
      interface TestCompleteEvent extends Event {
        detail: TestCounts;
      }

      globalThis.addEventListener('testscomplete', (event) => {
        const testEvent = event as TestCompleteEvent;
        (globalThis as any).ciHarnessEvent('end', testEvent.detail);
      });
    });
  }

  async navigate(url: string) {
    const { promise } = Promise.withResolvers<void>();
    this.#runner.trace('harness', `navigating to ${url}`);

    // Navigate to test page
    await this.#page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    this.#runner.trace('harness', 'page loaded, waiting for tests');

    // Wait for tests to complete
    await Promise.race([promise, this.#page.waitForTimeout(this.#runner.options.timeout * 1000)]);
  }

  async screenshot() {
    if (this.#runner.options.screenshot || process.env['CI']) {
      await this.#page.screenshot({
        path: this.#runner.options.screenshot || 'test-completion.png',
        fullPage: true,
      });
    }
  }
}

class TestRunner {
  readonly #options: CommandOptions;

  constructor(options: CommandOptions) {
    this.#options = options;
  }

  get #headless() {
    const options = this.#options;
    return !options.headed && (options.ci || options.check || !!process.env['CI']);
  }

  get options() {
    return this.#options;
  }

  get failingOnly() {
    return this.#options.failingOnly || this.#options.check;
  }

  trace(type: TraceType, msg: string, ...args: unknown[]): void {
    const options = this.#options;
    if (options.traceHarness.includes(type) || options.traceHarness.includes('*')) {
      console.error(`[CI]`, msg, ...args);
    }
  }

  traces(type: TraceType): boolean {
    const options = this.#options;
    return options.traceHarness.includes(type) || options.traceHarness.includes('*');
  }

  async launch(): Promise<{
    page: TestPage;
    port: number;
  }> {
    const options = this.#options;

    const { port, cleanup: cleanupVite } = await startViteServer({
      cwd: __root,
      timeout: 30000,
      debug: options.traceHarness.includes('vite') || options.traceHarness.includes('*'),
    });

    this.trace('harness', `vite started on port ${port}`);

    // Determine video recording settings
    let recordVideo: boolean | { dir: string } | undefined;
    if (options.video) {
      recordVideo = { dir: options.video };
    } else if (options.ci) {
      recordVideo = { dir: './test-videos' };
    }

    // Use the centralized browser setup
    const { browser, context } = await setupBrowser({
      browser: options.browser,
      headless: this.#headless,
      ignoreHTTPSErrors: true,
      recordVideo,
    });

    this.trace('harness', 'playwright browser launched');

    const page = await context.newPage();

    return {
      page: new TestPage(this, page, {
        cleanup: () => {
          cleanupVite();
        },
        dispose: async () => {
          cleanupVite();
          await context.close();
          await browser.close();
        },
      }),
      port,
    };
  }

  buildQueryParams(): string {
    const options = this.#options;
    const ids = options.ids?.split(',').map((id) => id.trim());

    return buildQueryParams((qps) =>
      qps
        .addFlag(options.enableTraceLogging, 'enable_trace_logging')
        .addFlag(options.enableSubtleLogging, 'enable_subtle_logging')
        .addOption(options.filter, 'filter')
        .addList(ids, 'testId')
        .addRaw(options.query)
    );
  }
}

await command.parseAsync();
