#!/usr/bin/env node --experimental-strip-types --disable-warning=ExperimentalWarning
/* eslint-disable n/hashbang */
/**
 * Essential CI Checks Script
 *
 * Fast validation checks before pushing. No builds, just lint and syntax validation.
 */
/* eslint-enable n/hashbang */

import { performance } from 'node:perf_hooks';

import chalk from 'chalk';
import { execa } from 'execa';

interface CheckResult {
  step: string;
  status: 'pass' | 'fail';
  duration: number;
  error?: string;
}

class CIChecker {
  private results: CheckResult[] = [];
  private startTime: number;

  constructor() {
    this.results = [];
    this.startTime = performance.now();
  }

  log(message: string): void {
    console.log(message);
  }

  logStep(stepName: string): void {
    this.log(`\n${chalk.cyan('🔄')} ${stepName}...`);
  }

  logSuccess(stepName: string, duration: number): void {
    this.log(`${chalk.green('✅')} ${stepName} ${chalk.gray(`(${duration}ms)`)}`);
  }

  logError(stepName: string, error: string, duration: number): void {
    this.log(`${chalk.red('❌')} ${stepName} FAILED ${chalk.gray(`(${duration}ms)`)}`);
    this.log(`${chalk.red('   ' + error)}`);
  }

  async runCommand(command: string, args: string[], description: string): Promise<void> {
    const stepStart = performance.now();
    this.logStep(description);

    try {
      await execa(command, args, {
        stdio: 'pipe',
        timeout: 30000, // 30 seconds max per command
      });

      const duration = Math.round(performance.now() - stepStart);
      this.logSuccess(description, duration);
      this.results.push({ step: description, status: 'pass', duration });
    } catch (error: unknown) {
      const duration = Math.round(performance.now() - stepStart);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logError(description, errorMessage, duration);
      this.results.push({ step: description, status: 'fail', duration, error: errorMessage });
      throw error;
    }
  }

  async runCIChecks(): Promise<void> {
    this.log(`${chalk.bold.blue('🚀 Running Essential CI Checks')}\n`);

    try {
      // Just the essential checks - no builds
      this.log(chalk.bold.yellow('🔍 Linting'));
      await this.runCommand('pnpm', ['test:lint'], 'ESLint validation');

      this.log(chalk.bold.yellow('🔧 Build Verification'));
      await this.runCommand(
        'node',
        ['./bin/build-verify.mjs'],
        'Checking for forbidden code in builds'
      );

      // Note: Full TypeScript checking is done via Turbo in CI
      // This script focuses on fast pre-push validation
    } catch {
      this.log(`\n${chalk.bold.red('💥 Essential Checks FAILED')}`);
      this.printSummary();
      throw new Error('Essential CI checks failed');
    }

    this.log(`\n${chalk.bold.green('🎉 Essential Checks PASSED!')}`);
    this.printSummary();
  }

  printSummary(): void {
    const totalDuration = Math.round(performance.now() - this.startTime);
    const passed = this.results.filter((r) => r.status === 'pass').length;
    const failed = this.results.filter((r) => r.status === 'fail').length;

    this.log(`\n${chalk.bold('📊 Summary:')}`);
    this.log(`   Total time: ${totalDuration}ms`);
    this.log(`   ${chalk.green('✅ Passed:')} ${passed}`);
    this.log(`   ${chalk.red('❌ Failed:')} ${failed}`);

    if (failed > 0) {
      this.log(`\n${chalk.bold.red('Failed checks:')}`);
      this.results
        .filter((r: CheckResult) => r.status === 'fail')
        .forEach((r: CheckResult) => this.log(`   ${chalk.red('•')} ${r.step}`));
    }

    this.log(`\n${chalk.bold('💡 Fast validation only - TypeScript checked via Turbo in CI')}`);
  }
}

// Run the checks
const checker = new CIChecker();
try {
  await checker.runCIChecks();
} catch (error: unknown) {
  console.error('Failed to run essential CI checks:', error);
  throw error;
}
