#!/usr/bin/env node

import { join } from 'node:path';

import { Command, Option } from '@commander-js/extra-typings';
import { BENCHMARK_ROOT } from '@glimmer-workspace/repo-metadata';
import chalk from 'chalk';
import fs from 'fs-extra';
import type { Page } from 'playwright';
import {
  BrowserPageWrapper,
  BrowserRunner,
  ConsoleLogger,
  Logger,
  setupBenchmarkHelpers,
  startViteServer,
  type BrowserRunnerOptions,
  type LogKind,
  type PageEventHandlers,
  type ServerInfo,
  type ShouldRecord,
} from '../browser/browser-utils-playwright.mts';
import type { InferOptions } from '../tests/run-tests-playwright.mts';

interface BenchmarkOptions extends BrowserRunnerOptions {
  headed?: boolean;
  screenshot?: boolean;
}

export function BenchmarkPage(
  page: Page,
  options: BenchmarkOptions
): { page: BrowserPageWrapper; complete: PromiseWithTimeout<void> } {
  const logger = Logger.from(options.logger);
  const resolvers = Promise.withResolvers<void>();

  const handlers: PageEventHandlers = {
    onInit: async (wrapper) => {
      await setupBenchmarkHelpers(wrapper.playwright);

      // Expose benchmark-specific functions
      await wrapper.exposeFunctions({
        reportBenchmarkResult: (name: string, result: any) => {
          console.log(chalk.green(`✓ ${name}:`), result);
        },
        benchmarkComplete: async () => {
          // Resolve the promise to signal completion
          resolvers.resolve();
        },
      });
    },
    onConsole: async (msg) => {
      const type = msg.type();
      const args = await Promise.all(
        msg.args().map((arg: any) => arg.jsonValue().catch(() => arg.toString()))
      );
      const message = args.join(' ');
      const kind = logKind(type);

      logger.log(kind, { type, message: message });
    },
    onPageError: (error) => {
      logger.stack('Page', error);
    },
    onRequestFailed: (request) => {
      const failure = request.failure();
      console.error(
        chalk.red(`[Request Failed] ${request.method()} ${request.url()}: ${failure?.errorText}`)
      );
    },
  };

  const pageWrapper = new BrowserPageWrapper(page, options, handlers);

  return {
    page: pageWrapper,
    complete: withTimeout(resolvers.promise, options.timeout),
  };
}

export type ResultWithTimeout<T> = { status: 'fulfilled'; value: T } | { status: 'timedout' };
export type PromiseWithTimeout<T> = Promise<ResultWithTimeout<T>>;

function withTimeout<T>(promise: Promise<T>, timeout: number | undefined): PromiseWithTimeout<T> {
  if (timeout === undefined) {
    return promise.then((value) => ({ status: 'fulfilled', value }));
  }

  return Promise.race([
    promise,
    new Promise((fulfill) =>
      setTimeout(() => {
        console.log({ rejecting: timeout });
        fulfill(false);
      }, timeout * 1000)
    ),
  ]) as Promise<ResultWithTimeout<T>>;
}

function logKind(type: string): LogKind {
  switch (type) {
    case 'log':
    case 'info':
    case 'debug':
      return 'info';
    case 'error':
      return 'error';
    case 'warning':
      return 'warn';
    default:
      return 'info';
  }
}

// Create the command-line interface
const command = new Command()
  .name('bench-quick')
  .description('Run Glimmer VM benchmarks')
  .version('1.0.0')
  .addOption(
    new Option('-b, --browser <browser>', 'browser to use')
      .choices(['chromium', 'firefox', 'webkit'])
      .default('chromium')
  )
  .option('--headed', 'run benchmarks in headed mode (show browser)', false)
  .option('--headless', 'run benchmarks in headless mode', false)
  .option('--screenshot [path]', 'capture screenshot on completion', false)
  .option('--record-video [path]', 'record video of benchmark run', false)
  .option(
    '-t, --timeout <seconds>',
    'benchmark timeout in seconds',
    (value) => parseInt(value, 10),
    60
  )
  .option('--debug-network', 'enable network debugging', false)
  .action(async (options) => {
    // Check if benchmark packages exist
    const packagesDir = join(BENCHMARK_ROOT, 'packages');
    if (!fs.existsSync(packagesDir) || fs.readdirSync(packagesDir).length === 0) {
      console.error(chalk.red('\nError: Benchmark packages not found!'));
      console.error(chalk.yellow('\nPlease run: pnpm benchmark:setup'));
      console.error(
        chalk.gray('\nThis will build the necessary package tarballs for benchmarking.\n')
      );
      process.exit(1);
    }

    console.log(chalk.green('Starting benchmark server...'));

    try {
      // Configure benchmark runner options
      const runnerOptions: BenchmarkOptions = {
        browser: options.browser,
        headless: options.headless || (!options.headed && !!process.env['CI']),
        timeout: options.timeout,
        record: {
          screenshot: shouldRecord(options.screenshot),
          video: shouldRecord(options.recordVideo),
        },
        viewport: { width: 1920, height: 1080 },
      };

      // Create benchmark runner
      const runner = new BrowserRunner({
        options: runnerOptions,
        name: 'BenchmarkRunner',
        startServer: async (): Promise<ServerInfo> => {
          return await startViteServer({
            cwd: BENCHMARK_ROOT,
            command: 'pnpm start',
            debug: false,
          });
        },
        createPageWrapper: BenchmarkPage,
      });

      const {
        created: { page, complete },
        port,
      } = await runner.launch();
      const url = `http://localhost:${port}`;

      console.log(chalk.green(`✓ Server started on port ${port}`));
      console.log(chalk.cyan(`\nBenchmark URL: ${url}`));

      if (runnerOptions.headless) {
        console.log(chalk.yellow('\nRunning benchmark in headless mode...'));

        try {
          // Measure page performance
          const startTime = Date.now();

          // Navigate to benchmark
          console.log(chalk.gray('Navigating to benchmark...'));
          await page.navigate(url, {
            waitFor: 'networkidle',
            timeout: 30000,
          });

          const loadTime = Date.now() - startTime;
          console.log(chalk.green(`✓ Page loaded in ${loadTime}ms`));

          // Wait for benchmarks to be ready
          console.log(chalk.gray('Waiting for benchmark to be ready...'));
          await page.waitForIdle({ timeout: 10000 });

          // Wait for benchmark results
          console.log(chalk.cyan('\nRunning benchmarks...'));
          console.log(chalk.gray('This may take a minute...\n'));

          // Wait for benchmark completion or timeout
          const { status } = (await complete) ?? { status: 'fulfilled' };

          if (status === 'timedout') {
            console.log(chalk.yellow('\n⚠️  Benchmark timed out'));
          } else {
            console.log(chalk.green('\n✅ Benchmark completed'));

            // Get performance results
            const results = await page.playwright.evaluate(() => {
              const entries = performance.getEntriesByType('measure');
              return entries.map((e) => ({ name: e.name, duration: e.duration }));
            });

            // Log results
            console.log(chalk.cyan('\nBenchmark Results:'));
            results.forEach((result) => {
              if (result.name !== 'load') {
                console.log(chalk.gray(`  ${result.name}: ${result.duration.toFixed(2)}ms`));
              }
            });

            if (options.screenshot) {
              const { path } = await page.screenshot('benchmark-complete.png');
              console.log(chalk.gray(`\nScreenshot saved to ${path}`));
            }
          }
        } finally {
          await runner.cleanup();

          // Exit cleanly - there are lingering handles from child processes
          // that we can't easily clean up. This is a common issue with Node.js
          // CLI tools and using process.exit(0) is the standard solution.
          process.exit(0);
        }
      } else {
        console.log(chalk.yellow('\nOpening benchmark in browser...'));
        console.log(chalk.gray('Run with --headless to run in headless mode'));

        await page.navigate(url);

        console.log(chalk.green('\n✅ Browser opened!'));
        console.log(chalk.gray('Press Ctrl+C to stop the server and close the browser.\n'));

        // Keep the process running
        process.on('SIGINT', async () => {
          console.log(chalk.yellow('\nShutting down...'));
          await runner.cleanup();
          process.exit(0);
        });
      }
    } catch (error) {
      console.error(chalk.red('\nBenchmark failed:'), error);
      process.exit(1);
    }
  });

// Error handling for uncaught errors
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('\nUnhandled rejection:'), error);
  process.exit(1);
});

// Parse command line arguments
await command.parseAsync();

function shouldRecord(value: string | boolean | undefined): ShouldRecord | undefined {
  if (typeof value === 'boolean') {
    return value;
  } else if (typeof value === 'string') {
    return { dir: value };
  } else {
    return undefined;
  }
}
