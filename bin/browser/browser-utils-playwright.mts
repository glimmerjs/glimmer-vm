import chalk from 'chalk';
import { execa } from 'execa';
import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContext,
  type ConsoleMessage,
  type Page,
  type Request,
  type Response,
} from 'playwright';
import type { PageFunction } from 'playwright-core/types/structs';
import stripAnsi from 'strip-ansi';
import treeKill from 'tree-kill';
import type { JsonValue } from 'type-fest';
import { join, sep } from 'node:path';
import { exhausted } from '../lib/utils.ts';
import type { PromiseWithTimeout } from '../bench/bench-quick.mts';

export interface ViteServerOptions {
  cwd: string;
  command?: string;
  timeout?: number;
  debug?: boolean;
}

export interface BrowserSetupOptions {
  browser?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  viewport?: { width: number; height: number };
  locale?: string;
  timezone?: string;
  deviceScaleFactor?: number;
  hasTouch?: boolean;
  isMobile?: boolean;
  permissions?: string[];
  geolocation?: { latitude: number; longitude: number };
  colorScheme?: 'light' | 'dark' | 'no-preference';
  reducedMotion?: 'reduce' | 'no-preference';
  forcedColors?: 'active' | 'none';
  extraHTTPHeaders?: Record<string, string>;
  httpCredentials?: { username: string; password: string };
  ignoreHTTPSErrors?: boolean;
  javaScriptEnabled?: boolean;
  bypassCSP?: boolean;
  userAgent?: string;
  recordVideo?: boolean | { dir: string } | undefined;
  recordHar?: boolean;
  serviceWorkers?: 'allow' | 'block';
  screenshotOnFailure?: boolean;
  enableTracing?: boolean;
}

// Vite server starter remains the same
export async function startViteServer(
  options: ViteServerOptions
): Promise<{ port: number; cleanup: () => void }> {
  const {
    cwd,
    command = 'pnpm vite --host --force --no-open',
    timeout = 30000,
    debug = false,
  } = options;

  return new Promise((resolve, reject) => {
    // Parse command to separate executable and args
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    if (!cmd) {
      throw new Error('Invalid command: no executable specified');
    }

    // Use execa for better process management
    const runvite = execa(cmd, args, {
      cwd,
      env: { ...process.env, CI: 'false' },
      cleanup: true, // Automatically cleanup on exit
      reject: false, // Don't reject on non-zero exit
      detached: false, // Keep in same process group
      stdio: ['ignore', 'pipe', 'pipe'], // Ignore stdin, pipe stdout/stderr
    });

    const timeoutId = setTimeout(() => {
      runvite.cancel();
      reject(new Error('Vite failed to start within ' + timeout + 'ms'));
    }, timeout);

    let stdoutBuffer = '';
    let stderrBuffer = '';
    let portFound = false;

    const checkForPort = (buffer: string): string | undefined => {
      const cleanBuffer = stripAnsi(buffer);
      const port = /https?:\/\/localhost:(\d+)/u.exec(cleanBuffer)?.[1];
      return port;
    };

    runvite.stderr?.on('data', (data) => {
      const chunk = String(data);
      if (debug) console.error('[vite stderr]', chunk);
      if (portFound) return;

      stderrBuffer += chunk;
      const port = checkForPort(stderrBuffer);
      if (port) {
        portFound = true;
        clearTimeout(timeoutId);
        resolve({
          port: Number(port),
          cleanup: async () => {
            // Kill the entire process tree
            if (runvite.pid) {
              try {
                await new Promise<void>((resolve, reject) => {
                  treeKill(runvite.pid!, 'SIGTERM', (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                });

                // Give it a moment to exit cleanly
                await new Promise((resolve) => setTimeout(resolve, 100));

                // Force kill if still running
                if (!runvite.killed) {
                  await new Promise<void>((resolve) => {
                    treeKill(runvite.pid!, 9, () => resolve());
                  });
                }
              } catch (err) {
                // Process might already be dead
                console.warn('Failed to kill process tree:', err);
              }
            }

            // Also try to cancel via execa
            try {
              runvite.cancel();
              await runvite;
            } catch {
              // Ignore errors
            }
          },
        });
      }
    });

    runvite.stdout?.on('data', (data) => {
      const chunk = String(data);
      if (debug) console.log('[vite stdout]', chunk);
      if (portFound) return;

      stdoutBuffer += chunk;
      const port = checkForPort(stdoutBuffer);
      if (port) {
        portFound = true;
        clearTimeout(timeoutId);
        resolve({
          port: Number(port),
          cleanup: async () => {
            // Kill the entire process tree
            if (runvite.pid) {
              try {
                await new Promise<void>((resolve, reject) => {
                  treeKill(runvite.pid!, 'SIGTERM', (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                });

                // Give it a moment to exit cleanly
                await new Promise((resolve) => setTimeout(resolve, 100));

                // Force kill if still running
                if (!runvite.killed) {
                  await new Promise<void>((resolve) => {
                    treeKill(runvite.pid!, 'SIGKILL', () => resolve());
                  });
                }
              } catch (err) {
                // Process might already be dead
                console.warn('Failed to kill process tree:', err);
              }
            }

            // Also try to cancel via execa
            try {
              runvite.cancel();
              await runvite;
            } catch {
              // Ignore errors
            }
          },
        });
      }
    });

    runvite.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });

    runvite.on('exit', (code) => {
      if (!portFound) {
        clearTimeout(timeoutId);
        reject(new Error(`Vite exited with code ${code}`));
      }
    });
  });
}

// Enhanced Playwright browser setup
export async function setupBrowser(
  options: BrowserSetupOptions = {}
): Promise<{ browser: Browser; context: BrowserContext }> {
  const {
    browser: browserType = 'chromium',
    headless = true,
    viewport = { width: 1280, height: 720 },
    locale = 'en-US',
    timezone = 'America/New_York',
    deviceScaleFactor = 1,
    hasTouch = false,
    isMobile = false,
    permissions = [],
    geolocation,
    colorScheme = 'light',
    reducedMotion = 'no-preference',
    forcedColors = 'none',
    extraHTTPHeaders,
    httpCredentials,
    ignoreHTTPSErrors = true,
    javaScriptEnabled = true,
    bypassCSP = false,
    userAgent,
    recordVideo = false,
    recordHar = false,
    serviceWorkers = 'allow',
    enableTracing = false,
  } = options;

  // Select browser engine
  const browserEngines = { chromium, firefox, webkit };
  const selectedBrowser = browserEngines[browserType];

  // Launch browser with Playwright
  const launchOptions: Parameters<typeof selectedBrowser.launch>[0] = {
    headless,
    // Playwright automatically handles sandboxing based on environment
    args: process.env['CI'] ? ['--disable-dev-shm-usage'] : [],
    // Can specify custom executable path if needed
    // executablePath: '/path/to/chrome',
    // Devtools automatically opens in headed mode
    devtools: !headless && process.env['DEVTOOLS'] === 'true',
  };

  // Add slowMo only if defined
  if (process.env['SLOW_MO']) {
    launchOptions.slowMo = parseInt(process.env['SLOW_MO']);
  }

  const browser = await selectedBrowser.launch(launchOptions);

  // Create context with rich configuration
  const contextOptions: Parameters<Browser['newContext']>[0] = {
    viewport,
    locale,
    timezoneId: timezone,
    deviceScaleFactor,
    hasTouch,
    isMobile,
    permissions,
    colorScheme,
    reducedMotion,
    forcedColors,
    ignoreHTTPSErrors,
    javaScriptEnabled,
    bypassCSP,
    serviceWorkers,
  };

  // Add optional properties only if defined
  if (geolocation !== undefined) {
    contextOptions.geolocation = geolocation;
  }

  if (extraHTTPHeaders !== undefined) {
    contextOptions.extraHTTPHeaders = extraHTTPHeaders;
  }

  if (httpCredentials !== undefined) {
    contextOptions.httpCredentials = httpCredentials;
  }

  if (userAgent !== undefined) {
    contextOptions.userAgent = userAgent;
  }

  // Handle video recording
  if (typeof recordVideo === 'boolean') {
    if (recordVideo) {
      contextOptions.recordVideo = { dir: './headless', size: viewport };
    }
  } else if (recordVideo !== undefined) {
    contextOptions.recordVideo = recordVideo;
  }

  // Handle HAR recording
  if (recordHar) {
    contextOptions.recordHar = { path: './network.har', urlFilter: '**/*' };
  }

  const context = await browser.newContext(contextOptions);

  // Set default timeout for all actions
  context.setDefaultTimeout(30000);
  context.setDefaultNavigationTimeout(30000);

  // Enable tracing if requested (for debugging)
  if (enableTracing || process.env['TRACE']) {
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
  }

  return { browser, context };
}

export type LoadState = 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
export type WaitFor =
  | { selector: string }
  | { function: string | PageFunction<void, void> }
  | { url: string | RegExp | ((url: URL) => boolean) }
  | LoadState
  | undefined;

type NormalizedWaitFor =
  | {
      type: 'selector';
      value: string;
    }
  | {
      type: 'function';
      value: string | PageFunction<void, void>;
    }
  | {
      type: 'url';
      value: string | RegExp | ((url: URL) => boolean);
    }
  | {
      type: 'loadState';
      value: LoadState;
    };

function normalizeWaitFor(wait: WaitFor): NormalizedWaitFor {
  if (wait === undefined) {
    return { type: 'loadState', value: 'load' };
  } else if (typeof wait === 'string') {
    return { type: 'loadState', value: wait };
  } else if ('selector' in wait) {
    return { type: 'selector', value: wait.selector };
  } else if ('function' in wait) {
    return { type: 'function', value: wait.function };
  } else if ('url' in wait) {
    return { type: 'url', value: wait.url };
  } else {
    exhausted(wait, `Invalid waitFor type: ${JSON.stringify(wait)}`);
  }
}

export interface NavigateOptions {
  waitFor?: WaitFor;
  timeout?: number;
  referer?: string;
}

// Enhanced navigation with Playwright's features
export async function navigateAndWait(
  page: Page,
  url: string,
  options: NavigateOptions = {}
): Promise<void> {
  const { waitFor: rawWaitFor, timeout = 30000, referer } = options || {};

  const waitFor = normalizeWaitFor(rawWaitFor);

  // Navigate with options
  const gotoOptions: Parameters<Page['goto']>[1] = {
    timeout,
  };

  if (waitFor.type === 'loadState') {
    gotoOptions.waitUntil = waitFor.value;
  }

  if (referer !== undefined) {
    gotoOptions.referer = referer;
  }

  await page.goto(url, gotoOptions);

  // Additional wait conditions
  if (waitFor.type === 'selector') {
    await page.locator(waitFor.value).waitFor({
      state: 'visible',
      timeout,
    });
  }

  if (waitFor.type === 'function') {
    await page.waitForFunction(waitFor.value, { timeout });
  }

  if (waitFor.type === 'url') {
    await page.waitForURL(waitFor.value, { timeout });
  }
}

// Playwright-specific utilities

export interface WaitForIdleOptions {
  timeout?: number;
  idleTime?: number;
}

// Wait for page to be completely idle (no network activity)
export async function waitForPageIdle(page: Page, options?: WaitForIdleOptions): Promise<void> {
  const { timeout = 30000, idleTime = 500 } = options || {};

  // Wait for network to be idle for specified time
  await page.waitForLoadState('networkidle', { timeout });

  // Additional wait to ensure no late requests
  await page.waitForTimeout(idleTime);
}

// Expose functions from Node to browser context
export async function exposeFunctions(
  page: Page,
  functions: Record<string, Function>
): Promise<void> {
  for (const [name, fn] of Object.entries(functions)) {
    await page.exposeFunction(name, fn);
  }
}

// Example: Expose Node.js functions to browser
export async function setupBenchmarkHelpers(page: Page): Promise<void> {
  // Expose filesystem operations
  await page.exposeFunction('readFileFromNode', async (path: string) => {
    const fs = await import('fs/promises');
    return fs.readFile(path, 'utf-8');
  });

  // Expose performance tracking
  await page.exposeFunction('markPerformance', (name: string, value: number) => {
    console.log(`[Performance] ${name}: ${value}ms`);
    // Could write to file, send to monitoring service, etc.
  });

  // Expose benchmark result collection
  await page.exposeFunction('saveBenchmarkResults', async (results: any) => {
    const fs = await import('fs/promises');
    await fs.writeFile('benchmark-results.json', JSON.stringify(results, null, 2));
    return true;
  });

  // Add custom commands to window
  await page.addInitScript(() => {
    // This runs in the browser context before any page scripts
    (window as any).benchmarkHelpers = {
      startTimer: (name: string) => {
        (window as any).__timers = (window as any).__timers || {};
        (window as any).__timers[name] = performance.now();
      },
      endTimer: async (name: string) => {
        const timers = (window as any).__timers || {};
        if (timers[name]) {
          const duration = performance.now() - timers[name];
          // Call the exposed Node function
          await (window as any).markPerformance(name, duration);
          return duration;
        }
        return null;
      },
      collectMetrics: () => {
        const navigation = performance.getEntriesByType(
          'navigation'
        )[0] as PerformanceNavigationTiming;
        const paint = performance.getEntriesByType('paint');
        return {
          navigation: {
            fetchStart: navigation.fetchStart,
            domContentLoaded:
              navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          },
          paint: paint.reduce(
            (acc, entry) => {
              acc[entry.name] = entry.startTime;
              return acc;
            },
            {} as Record<string, number>
          ),
          memory: performance.measureUserAgentSpecificMemory
            ? {
                usedJSHeapSize: performance.measureUserAgentSpecificMemory().usedJSHeapSize,
                totalJSHeapSize: performance.measureUserAgentSpecificMemory().totalJSHeapSize,
                jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
              }
            : null,
        };
      },
    };
  });
}

declare global {
  interface Performance {
    measureUserAgentSpecificMemory(): {
      totalJSHeapSize: number;
      usedJSHeapSize: number;
    };
  }
}

// Advanced screenshot with annotations
export async function takeAnnotatedScreenshot(
  page: Page,
  path: string,
  options?: {
    fullPage?: boolean;
    clip?: { x: number; y: number; width: number; height: number };
    quality?: number;
    type?: 'png' | 'jpeg';
    omitBackground?: boolean;
    annotations?: Array<{
      type: 'highlight' | 'redact';
      selector: string;
      color?: string;
    }>;
  }
): Promise<void> {
  const { annotations = [], ...screenshotOptions } = options || {};

  // Apply annotations before screenshot
  for (const annotation of annotations) {
    if (annotation.type === 'highlight') {
      await page.locator(annotation.selector).evaluate((el, color) => {
        (el as HTMLElement).style.outline = `3px solid ${color || 'red'}`;
        (el as HTMLElement).style.outlineOffset = '2px';
      }, annotation.color);
    } else if (annotation.type === 'redact') {
      await page.locator(annotation.selector).evaluate((el) => {
        (el as HTMLElement).style.filter = 'blur(8px)';
      });
    }
  }

  // Take screenshot
  await page.screenshot({
    path,
    fullPage: true,
    ...screenshotOptions,
  });

  // Remove annotations
  for (const annotation of annotations) {
    if (annotation.type === 'highlight') {
      await page.locator(annotation.selector).evaluate((el) => {
        (el as HTMLElement).style.outline = '';
        (el as HTMLElement).style.outlineOffset = '';
      });
    } else if (annotation.type === 'redact') {
      await page.locator(annotation.selector).evaluate((el) => {
        (el as HTMLElement).style.filter = '';
      });
    }
  }
}

// Base classes for browser automation

export interface LoggerDelegate {
  /**
   * Print directly to the stdout stream.
   */
  stdout: (message: string) => void;

  log: (kind: LogKind, options: NormalizedLogArgs) => void;
}

export type LogKind = 'error' | 'warn' | 'info' | 'trace';
export type LogFilter = (type: string, category: LogKind) => boolean;

export class ConsoleLogger implements LoggerDelegate {
  static DEFAULT = new ConsoleLogger(console);

  static all(options?: { console: Console }): ConsoleLogger {
    return new ConsoleLogger(options?.console ?? console);
  }

  static filter(filter: LogFilter, options?: { console: Console }): ConsoleLogger {
    return new ConsoleLogger(options?.console ?? console, filter);
  }

  readonly #console: Console;
  readonly #filter: LogFilter;

  constructor(console: Console, filter: LogFilter = () => true) {
    this.#console = console;
    this.#filter = filter;
  }

  stdout = (message: string) => {
    this.#console.log(message);
  };

  log = (kind: LogKind, { type, message }: NormalizedLogArgs) => {
    if (this.#filter(type, kind)) {
      switch (kind) {
        case 'error':
          this.#console.error(chalk.red(`[${type}] ${message}`));
          break;
        case 'warn':
          this.#console.warn(chalk.yellow(`[${type}] ${message}`));
          break;
        case 'info':
          this.#console.log(`[${type}] ${message}`);
          break;
        case 'trace':
          this.#console.debug(chalk.gray(`[${type}] ${message}`));
          break;
      }
    }
  };
}

type LogArgs = [message: string] | [type: string, message: string];
type NormalizedLogArgs = { message: string; type: string };

function logArgs(args: LogArgs): NormalizedLogArgs {
  if (args.length === 1) {
    return { message: args[0], type: 'info' };
  } else {
    return { message: args[1], type: args[0] };
  }
}

export type IntoLogger = Logger | LoggerDelegate | undefined;

export class Logger implements LoggerDelegate {
  static CONSOLE = new Logger(ConsoleLogger.DEFAULT);

  static from(logger: IntoLogger): Logger {
    if (logger === undefined) {
      return Logger.CONSOLE;
    } else if (logger instanceof Logger) {
      return logger;
    } else {
      return new Logger(logger);
    }
  }

  #logger: LoggerDelegate;

  constructor(logger: LoggerDelegate) {
    this.#logger = logger;
  }

  stdout = (message: string): void => {
    this.#logger.stdout(message);
  };

  log = (kind: LogKind, { type, message }: NormalizedLogArgs): void => {
    this.#logger.log(kind, { type, message });
  };

  /**
   * Print a JSON message to the stdout stream.
   */
  json = (message: JsonValue): void => {
    this.#logger.stdout(JSON.stringify(message, null, 2));
  };

  #log(kind: LogKind, args: LogArgs): void {
    this.#logger.log(kind, logArgs(args));
  }

  /**
   * Print an error message to the stderr stream, formatted as an error.
   */
  error = (...args: LogArgs): void => {
    this.#log('error', args);
  };

  /**
   * Print a stack trace for an error to the stderr stream.
   *
   * The error message will be printed as `error`, and the stack trace, if available, will be printed as `info`.
   */
  stack = (type: string, error: Error): void => {
    this.error(type, error.message);
    // Print the stack trace if available
    if (error.stack) {
      this.info(error.stack);
    }
  };

  /**
   * Print a warning message to the stderr stream, formatted as a warning.
   */
  warn = (...args: LogArgs): void => {
    this.#log('warn', args);
  };
  /**
   * Print a log message to the stderr stream without special formatting.
   */
  info = (...args: LogArgs): void => {
    this.#log('info', args);
  };

  /**
   * Print a trace message to the stderr stream.
   * This is used for debugging and tracing execution flow.
   */
  trace = (...args: LogArgs): void => {
    this.#log('trace', args);
  };
}

export type ShouldRecord = boolean | { dir: string };

export interface RecordOptions {
  video?: ShouldRecord | undefined;
  screenshot?: ShouldRecord | undefined;
}

export interface BrowserRunnerOptions {
  headless?: boolean;
  logger?: IntoLogger;
  browser?: 'chromium' | 'firefox' | 'webkit';
  timeout?: number;
  record?: RecordOptions;
  viewport?: { width: number; height: number };
  debug?: boolean;
}

export interface ServerInfo {
  port: number;
  cleanup: () => void | Promise<void>;
}

export interface PageEventHandlers {
  onConsole?: (msg: ConsoleMessage) => void | Promise<void>;
  onPageError?: (error: Error) => void;
  onRequestFailed?: (request: Request) => void;
  onRequest?: (request: Request) => void;
  onResponse?: (response: Response) => void;
  onInit?: (wrapper: BrowserPageWrapper) => void | Promise<void>;
}

export function recordDir(
  type: 'video' | 'screenshot',
  options: RecordOptions | undefined
): string | undefined {
  const recordItem = options?.[type];
  if (typeof recordItem === 'object') {
    return recordItem.dir;
  } else if (recordItem === false) {
    return undefined;
  } else {
    return `./headless`;
  }
}

export function recordPath(
  type: 'video' | 'screenshot',
  options: RecordOptions | undefined,
  path: {
    filename?: string | undefined;
    default: string;
  }
): string | undefined {
  if (path.filename?.includes(sep)) {
    return path.filename;
  }

  const dir = recordDir(type, options);

  if (!dir) {
    return undefined;
  }

  return join(dir, path.filename ?? path.default);
}

export class BrowserPageWrapper {
  readonly #page: Page;
  readonly #options: BrowserRunnerOptions;
  readonly #handlers: PageEventHandlers;

  constructor(page: Page, options: BrowserRunnerOptions, eventHandlers: PageEventHandlers = {}) {
    this.#page = page;
    this.#options = options;
    this.#handlers = eventHandlers;
    setupHandlers(page, eventHandlers);
  }

  async navigate(url: string, options?: Parameters<typeof navigateAndWait>[2]): Promise<void> {
    await navigateAndWait(this.#page, url, options);
  }

  /**
   * Take a screenshot of the current page. If `outputPath` is provided:
   *
   * - If it contains a `/`, it is treated as a full path (relative to `cwd`) and saved there. This
   *   overrides any `dir` option in `options.record.screenshot`.
   * - If it is just a filename, it will be saved in the screenshots directory
   *   (`options.record.screenshot.dir` if provided, or `./headless/`).
   */
  async screenshot(outputPath?: string): Promise<{ path: string | undefined }> {
    const path = recordPath('screenshot', this.#options.record, {
      filename: outputPath,
      default: 'screenshot.png',
    });

    if (path) {
      await this.#page.screenshot({
        path,
        fullPage: true,
      });

      return { path };
    }

    return { path: undefined };
  }

  async exposeFunctions(functions: Record<string, Function>): Promise<void> {
    await exposeFunctions(this.#page, functions);
  }

  /**
   * Wait for the page to be idle, which means no network activity in the queue. If an `onInit`
   * handler was provided, it will be called with this {@BrowserPageWrapper} instance once the page
   * is idle.
   */
  async waitForIdle(options?: WaitForIdleOptions): Promise<void> {
    await waitForPageIdle(this.#page, options);

    if (this.#handlers.onInit) {
      await this.#handlers.onInit(this);
    }
  }

  get playwright(): Page {
    return this.#page;
  }

  async dispose(): Promise<void> {
    // Can be extended if needed
  }
}

function setupHandlers(page: Page, handlers: PageEventHandlers): void {
  if (handlers.onConsole) {
    page.on('console', handlers.onConsole);
  }

  if (handlers.onPageError) {
    page.on('pageerror', handlers.onPageError);
  }

  if (handlers.onRequestFailed) {
    page.on('requestfailed', handlers.onRequestFailed);
  }

  if (handlers.onRequest) {
    page.on('request', handlers.onRequest);
  }

  if (handlers.onResponse) {
    page.on('response', handlers.onResponse);
  }
}

export interface CreatedPageWrapper {
  page: BrowserPageWrapper;
  complete?: PromiseWithTimeout<void>;
}

export interface BrowserRunnerConfig<TOptions extends BrowserRunnerOptions> {
  options: TOptions;
  startServer: () => Promise<ServerInfo>;
  /**
   * Create a {@link BrowserPageWrapper} instance for the page, based upon the provided
   * configuration. If `complete` is provided, it should be a Promise that resolves when the page
   * has finished performing its tasks and is ready to be inspected for the results.
   */
  createPageWrapper?: (page: Page, options: TOptions) => CreatedPageWrapper;
  name?: string;
}

export class BrowserRunner<TOptions extends BrowserRunnerOptions> {
  readonly options: TOptions;
  #browser?: Browser;
  #context?: BrowserContext;
  #serverInfo?: ServerInfo;
  #config: BrowserRunnerConfig<TOptions>;

  constructor(config: BrowserRunnerConfig<TOptions>) {
    this.#config = config;
    this.options = config.options;
  }

  private get headless(): boolean {
    return this.options.headless ?? !!process.env['CI'];
  }

  private debug(message: string, ...args: unknown[]): void {
    if (this.options.debug) {
      const name = this.#config.name || 'BrowserRunner';
      console.error(`[${name}]`, message, ...args);
    }
  }

  async launch(): Promise<{
    created: CreatedPageWrapper;
    port: number;
  }> {
    // Start server
    this.#serverInfo = await this.#config.startServer();
    this.debug(`Server started on port ${this.#serverInfo.port}`);

    // Setup browser
    const { browser, context } = await setupBrowser({
      browser: this.options.browser ?? 'chromium',
      headless: this.headless,
      viewport: this.options.viewport ?? { width: 1280, height: 720 },
      recordVideo: this.options.record?.video ?? false,
      ignoreHTTPSErrors: true,
    });

    this.#browser = browser;
    this.#context = context;

    const page = await context.newPage();
    const wrappedPage = this.#config.createPageWrapper
      ? this.#config.createPageWrapper(page, this.options)
      : { page: new BrowserPageWrapper(page, this.options) };

    return {
      created: wrappedPage,
      port: this.#serverInfo.port,
    };
  }

  async cleanup(): Promise<void> {
    // Close browser first to prevent connection errors
    if (this.#context) {
      await this.#context.close();
    }
    if (this.#browser) {
      await this.#browser.close();
    }

    // Then kill the server
    if (this.#serverInfo) {
      await this.#serverInfo.cleanup();
    }
  }
}

// Network throttling simulation
export async function throttleNetwork(
  page: Page,
  profile:
    | 'Fast 3G'
    | 'Slow 3G'
    | 'Offline'
    | 'No throttling'
    | {
        downloadThroughput: number;
        uploadThroughput: number;
        latency: number;
      }
): Promise<void> {
  const profiles = {
    'Fast 3G': {
      downloadThroughput: (1.6 * 1024 * 1024) / 8, // 1.6 Mbps
      uploadThroughput: (750 * 1024) / 8, // 750 Kbps
      latency: 150, // 150ms
    },
    'Slow 3G': {
      downloadThroughput: (500 * 1024) / 8, // 500 Kbps
      uploadThroughput: (500 * 1024) / 8, // 500 Kbps
      latency: 400, // 400ms
    },
    Offline: {
      downloadThroughput: 0,
      uploadThroughput: 0,
      latency: 0,
    },
    'No throttling': {
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    },
  };

  const config = typeof profile === 'string' ? profiles[profile] : profile;

  // Playwright doesn't have built-in network throttling, but we can use CDP
  const client = await page.context().newCDPSession(page);

  if (config.downloadThroughput === 0) {
    await client.send('Network.emulateNetworkConditions', {
      offline: true,
      downloadThroughput: 0,
      uploadThroughput: 0,
      latency: 0,
    });
  } else if (config.downloadThroughput === -1) {
    await client.send('Network.disable');
  } else {
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: config.downloadThroughput,
      uploadThroughput: config.uploadThroughput,
      latency: config.latency,
    });
  }
}
