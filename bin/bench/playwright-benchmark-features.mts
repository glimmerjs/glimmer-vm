#!/usr/bin/env node --disable-warning=ExperimentalWarning --experimental-strip-types

/**
 * This file demonstrates advanced Playwright features for benchmarking
 * that go beyond what Puppeteer offers, including:
 *
 * 1. Idle detection and network activity monitoring
 * 2. Exposing Node.js functions to the browser
 * 3. Advanced performance metrics collection
 * 4. Multi-browser testing
 * 5. Request interception and modification
 * 6. Browser context isolation for parallel tests
 * 7. Built-in test retry mechanisms
 * 8. Trace collection for debugging
 */

import type { Page } from '@playwright/test';
import { chromium, firefox, webkit } from '@playwright/test';
import chalk from 'chalk';
import fs from 'fs-extra';

// 1. IDLE DETECTION - Playwright's approach to detecting when page is idle
async function waitForCompleteIdle(
  page: Page,
  options?: {
    timeout?: number;
    networkIdleTime?: number;
    cpuIdleThreshold?: number;
  }
) {
  const { timeout = 30000, networkIdleTime = 500, cpuIdleThreshold = 10 } = options || {};

  console.log(chalk.gray('Waiting for page to become completely idle...'));

  // Wait for network to be idle
  await page.waitForLoadState('networkidle', { timeout });

  // Custom idle detection using multiple signals
  await page.waitForFunction(
    ({ networkIdleTime, cpuIdleThreshold }) => {
      return new Promise<boolean>((resolve) => {
        let networkIdleTimer: number | null = null;
        let lastActivity = Date.now();
        const observers: Array<() => void> = [];

        // Monitor network activity
        const networkObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'resource') {
              lastActivity = Date.now();
              if (networkIdleTimer) {
                clearTimeout(networkIdleTimer);
              }
              networkIdleTimer = window.setTimeout(() => {
                checkIdle();
              }, networkIdleTime);
            }
          }
        });
        networkObserver.observe({ entryTypes: ['resource'] });
        observers.push(() => networkObserver.disconnect());

        // Monitor DOM mutations
        const mutationObserver = new MutationObserver(() => {
          lastActivity = Date.now();
        });
        mutationObserver.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
        });
        observers.push(() => mutationObserver.disconnect());

        // Monitor animation frames (CPU activity)
        let frameCount = 0;
        let lastFrameCheck = Date.now();
        const checkFrameRate = () => {
          requestAnimationFrame(() => {
            frameCount++;
            const now = Date.now();
            if (now - lastFrameCheck > 1000) {
              const fps = frameCount;
              frameCount = 0;
              lastFrameCheck = now;

              // If FPS is low, consider it idle
              if (fps < cpuIdleThreshold) {
                checkIdle();
              } else {
                lastActivity = now;
              }
            }
            if (!resolved) {
              checkFrameRate();
            }
          });
        };
        checkFrameRate();

        let resolved = false;
        const checkIdle = () => {
          const idleTime = Date.now() - lastActivity;
          if (idleTime > networkIdleTime && !resolved) {
            resolved = true;
            observers.forEach((cleanup) => cleanup());
            resolve(true);
          }
        };

        // Initial check after network idle time
        networkIdleTimer = window.setTimeout(checkIdle, networkIdleTime);
      });
    },
    { networkIdleTime, cpuIdleThreshold },
    { timeout }
  );

  console.log(chalk.green('✓ Page is completely idle'));
}

// 2. EXPOSING NODE FUNCTIONS - Advanced bi-directional communication
async function setupBidirectionalCommunication(page: Page) {
  // Expose Node.js functionality to browser
  await page.exposeFunction('nodeFS', {
    readFile: async (path: string) => {
      return fs.readFile(path, 'utf-8');
    },
    writeFile: async (path: string, content: string) => {
      await fs.writeFile(path, content);
      return true;
    },
    exists: async (path: string) => {
      return fs.pathExists(path);
    },
  });

  // Expose benchmark data collection
  const benchmarkData: any[] = [];
  await page.exposeFunction('collectBenchmarkData', (data: any) => {
    benchmarkData.push({
      ...data,
      timestamp: Date.now(),
      nodeTimestamp: new Date().toISOString(),
    });
    console.log(chalk.blue('[Benchmark Data]'), data);
  });

  // Expose real-time performance monitoring
  await page.exposeFunction('reportPerformance', async (metrics: any) => {
    // Could send to monitoring service, write to database, etc.
    console.log(chalk.cyan('[Performance]'), metrics);

    // Example: Alert if memory usage is too high
    if (metrics.memory?.usedJSHeapSize > 100 * 1024 * 1024) {
      console.warn(chalk.yellow('⚠ High memory usage detected!'));
    }
  });

  // Inject browser-side helpers
  await page.addInitScript(() => {
    // Create a comprehensive benchmark API in the browser
    (window as any).benchmark = {
      // Measure function execution time
      measure: async (name: string, fn: Function) => {
        const start = performance.now();
        try {
          const result = await fn();
          const duration = performance.now() - start;
          await (window as any).collectBenchmarkData({
            type: 'measurement',
            name,
            duration,
            success: true,
          });
          return result;
        } catch (error) {
          const duration = performance.now() - start;
          await (window as any).collectBenchmarkData({
            type: 'measurement',
            name,
            duration,
            success: false,
            error: error.message,
          });
          throw error;
        }
      },

      // Profile memory usage
      profileMemory: async (label: string) => {
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          await (window as any).reportPerformance({
            label,
            memory: {
              usedJSHeapSize: memory.usedJSHeapSize,
              totalJSHeapSize: memory.totalJSHeapSize,
              jsHeapSizeLimit: memory.jsHeapSizeLimit,
            },
          });
        }
      },

      // Collect all performance metrics
      collectMetrics: async () => {
        const navigation = performance.getEntriesByType(
          'navigation'
        )[0] as PerformanceNavigationTiming;
        const resources = performance.getEntriesByType('resource');
        const paint = performance.getEntriesByType('paint');
        const measures = performance.getEntriesByType('measure');

        const metrics = {
          navigation: {
            fetchStart: navigation.fetchStart,
            domContentLoaded:
              navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
            responseTime: navigation.responseEnd - navigation.requestStart,
          },
          paint: paint.reduce(
            (acc, entry) => {
              acc[entry.name] = entry.startTime;
              return acc;
            },
            {} as Record<string, number>
          ),
          resources: {
            count: resources.length,
            totalSize: resources.reduce((sum, r: any) => sum + (r.transferSize || 0), 0),
            totalDuration: resources.reduce((sum, r: any) => sum + r.duration, 0),
          },
          measures: measures.map((m) => ({
            name: m.name,
            duration: m.duration,
            startTime: m.startTime,
          })),
        };

        await (window as any).collectBenchmarkData({
          type: 'metrics',
          metrics,
        });

        return metrics;
      },

      // Save results to file from browser
      saveResults: async (filename: string, data: any) => {
        const json = JSON.stringify(data, null, 2);
        return await (window as any).nodeFS.writeFile(filename, json);
      },
    };

    // Auto-collect metrics on page load
    window.addEventListener('load', () => {
      setTimeout(() => {
        (window as any).benchmark.collectMetrics();
      }, 1000);
    });
  });

  return benchmarkData;
}

// 3. ADVANCED PERFORMANCE MONITORING
async function setupPerformanceMonitoring(page: Page) {
  // Enable Chrome DevTools Protocol for advanced metrics
  const client = await page.context().newCDPSession(page);

  // Enable performance metrics
  await client.send('Performance.enable');

  // Collect runtime performance metrics
  const collectRuntimeMetrics = async () => {
    const { metrics } = await client.send('Performance.getMetrics');
    const metricsMap: Record<string, number> = {};

    for (const metric of metrics) {
      metricsMap[metric.name] = metric.value;
    }

    return metricsMap;
  };

  // Monitor JavaScript heap
  await client.send('HeapProfiler.enable');

  // Collect heap statistics
  const collectHeapStats = async () => {
    const stats = await client.send('Runtime.getHeapUsage');
    return {
      usedSize: stats.usedSize,
      totalSize: stats.totalSize,
      sizeLimit: stats.totalSize,
    };
  };

  // CPU profiling
  await client.send('Profiler.enable');
  await client.send('Profiler.setSamplingInterval', { interval: 100 });

  const startCPUProfile = async () => {
    await client.send('Profiler.start');
  };

  const stopCPUProfile = async () => {
    const { profile } = await client.send('Profiler.stop');
    return profile;
  };

  return {
    collectRuntimeMetrics,
    collectHeapStats,
    startCPUProfile,
    stopCPUProfile,
  };
}

// 4. MULTI-BROWSER BENCHMARK
async function runMultiBrowserBenchmark(url: string) {
  const browsers = [
    { name: 'Chromium', launch: chromium },
    { name: 'Firefox', launch: firefox },
    { name: 'WebKit', launch: webkit },
  ];

  const results: Record<string, any> = {};

  for (const { name, launch } of browsers) {
    console.log(chalk.blue(`\nRunning benchmark in ${name}...`));

    try {
      const browser = await launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      // Setup monitoring
      const benchmarkData = await setupBidirectionalCommunication(page);

      // Navigate and wait for idle
      await page.goto(url);
      await waitForCompleteIdle(page);

      // Collect browser-specific metrics
      const metrics = await page.evaluate(() => {
        return (window as any).benchmark.collectMetrics();
      });

      results[name] = {
        metrics,
        benchmarkData,
        userAgent: await page.evaluate(() => navigator.userAgent),
      };

      await browser.close();
      console.log(chalk.green(`✓ ${name} benchmark complete`));
    } catch (error) {
      console.error(chalk.red(`✗ ${name} benchmark failed:`, error.message));
      results[name] = { error: error.message };
    }
  }

  return results;
}

// 5. REQUEST INTERCEPTION AND MODIFICATION
async function setupRequestInterception(page: Page) {
  // Block unnecessary resources for faster benchmarks
  await page.route('**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2,ttf}', (route) => {
    route.abort();
  });

  // Mock API responses for consistent benchmarks
  await page.route('**/api/benchmark-data', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: Array(1000)
          .fill(0)
          .map((_, i) => ({
            id: i,
            value: Math.random() * 100,
          })),
      }),
    });
  });

  // Monitor and modify requests
  await page.route('**/*', async (route) => {
    const request = route.request();
    const headers = request.headers();

    // Add custom headers
    headers['X-Benchmark-Run'] = Date.now().toString();

    // Log API calls
    if (request.url().includes('/api/')) {
      console.log(chalk.gray(`[API Call] ${request.method()} ${request.url()}`));
    }

    await route.continue({ headers });
  });
}

// 6. PARALLEL CONTEXT EXECUTION
async function runParallelBenchmarks(urls: string[], concurrency: number = 3) {
  const browser = await chromium.launch({ headless: true });

  const runBenchmark = async (url: string, index: number) => {
    const context = await browser.newContext({
      // Isolate each benchmark
      storageState: undefined,
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    try {
      console.log(chalk.gray(`[${index}] Starting benchmark for ${url}`));

      await setupBidirectionalCommunication(page);
      await page.goto(url);
      await waitForCompleteIdle(page);

      const metrics = await page.evaluate(() => {
        return (window as any).benchmark.collectMetrics();
      });

      console.log(chalk.green(`[${index}] ✓ Completed benchmark for ${url}`));

      return { url, metrics, success: true };
    } catch (error) {
      console.error(chalk.red(`[${index}] ✗ Failed benchmark for ${url}:`, error.message));
      return { url, error: error.message, success: false };
    } finally {
      await context.close();
    }
  };

  // Run benchmarks in parallel with concurrency limit
  const results = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((url, j) => runBenchmark(url, i + j)));
    results.push(...batchResults);
  }

  await browser.close();
  return results;
}

// Example usage
async function main() {
  const url = 'http://localhost:3000/benchmark';

  // Example 1: Complete idle detection
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(url);
  await waitForCompleteIdle(page, {
    networkIdleTime: 1000,
    cpuIdleThreshold: 5,
  });

  // Example 2: Bidirectional communication
  const benchmarkData = await setupBidirectionalCommunication(page);

  // Run some benchmarks from the browser
  await page.evaluate(async () => {
    // This runs in the browser but can call Node functions
    const data = await (window as any).nodeFS.readFile('/tmp/test.txt');
    console.log('Read from Node:', data);

    // Run and measure a benchmark
    await (window as any).benchmark.measure('render-1000-items', async () => {
      // Simulate rendering
      for (let i = 0; i < 1000; i++) {
        const div = document.createElement('div');
        div.textContent = `Item ${i}`;
        document.body.appendChild(div);
      }
    });

    // Save results directly from browser
    const metrics = await (window as any).benchmark.collectMetrics();
    await (window as any).benchmark.saveResults('/tmp/benchmark-results.json', metrics);
  });

  await browser.close();

  // Example 3: Multi-browser benchmark
  const multiBrowserResults = await runMultiBrowserBenchmark(url);
  console.log('Multi-browser results:', multiBrowserResults);

  // Example 4: Parallel benchmarks
  const urls = [
    'http://localhost:3000/benchmark/test1',
    'http://localhost:3000/benchmark/test2',
    'http://localhost:3000/benchmark/test3',
  ];
  const parallelResults = await runParallelBenchmarks(urls, 2);
  console.log('Parallel results:', parallelResults);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  runMultiBrowserBenchmark,
  runParallelBenchmarks,
  setupBidirectionalCommunication,
  setupPerformanceMonitoring,
  setupRequestInterception,
  waitForCompleteIdle,
};
