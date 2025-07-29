# Refactoring Plan: setup-bench.mts

## Overview
The `setup-bench.mts` file is the TracerBench comparison runner that compares control vs experiment branches. Currently, it uses a custom server implementation and lacks the modern abstractions we've built in `bench-quick.mts`.

## Current State Analysis

### What setup-bench.mts does:
1. Builds control and experiment branches
2. Starts two Vite servers (control on port 4020, experiment on 4021)
3. Runs TracerBench to compare performance between the two
4. Outputs results to `tracerbench-results/msg.txt`

### Current Issues:
1. **Custom server implementation** - Uses raw `spawn()` instead of our `startViteServer()` utility
2. **No proper cleanup** - Missing tree-kill and proper process cleanup
3. **No browser abstractions** - Direct TracerBench CLI invocation without using our BrowserRunner
4. **No progress tracking** - Lacks the completion promise pattern from bench-quick
5. **Limited error handling** - Basic try/catch without detailed logging
6. **No recording options** - No screenshot/video capabilities

## Proposed Improvements

### 1. Use Shared Server Infrastructure
Replace the custom `startBenchmarkServer()` with our proven `startViteServer()`:
```typescript
// Replace lines 171-221 with:
const controlServer = await startViteServer({
  cwd: CONTROL_DIRS.bench,
  command: `pnpm vite preview --port ${CONTROL_PORT}`,
  debug: options.debug,
});

const experimentServer = await startViteServer({
  cwd: EXPERIMENT_DIRS.bench,
  command: `pnpm vite preview --port ${EXPERIMENT_PORT}`,
  debug: options.debug,
});
```

### 2. Add Command-Line Interface
Convert to use Commander.js like bench-quick:
- Add options for browser selection
- Add debug/verbose modes
- Add timeout configuration
- Add recording options (screenshots, HAR files)
- Add TracerBench-specific options (fidelity, markers, regression threshold)

### 3. Integrate BrowserRunner Pattern
While TracerBench handles its own browser automation, we can:
- Add pre/post hooks for screenshots
- Add better console logging
- Add progress indicators
- Consider wrapping TracerBench in our abstractions for consistency

### 4. Improve Process Management
- Use proper cleanup with tree-kill
- Add SIGINT handler for graceful shutdown
- Ensure servers are killed even on error
- Add process.exit(0) at the end

### 5. Better Error Reporting
- Add detailed error messages with suggestions
- Log server URLs and status
- Show progress for long-running operations
- Format TracerBench output better

### 6. Add TodoWrite Integration
Track the comparison workflow:
- Building control branch
- Building experiment branch
- Starting servers
- Running TracerBench comparison
- Analyzing results

## Implementation Steps

### Phase 1: Basic Refactoring
1. Replace server implementation with `startViteServer()`
2. Add proper cleanup and error handling
3. Test that TracerBench still works correctly

### Phase 2: CLI Enhancement
1. Convert to Commander.js
2. Add command-line options
3. Add help text and examples

### Phase 3: Advanced Features (Optional)
1. Add BrowserRunner integration for pre/post processing
2. Add screenshot capabilities before/after benchmark
3. Add result visualization
4. Consider direct Playwright integration instead of TracerBench CLI

## Code Structure

```typescript
#!/usr/bin/env node

import { Command, Option } from '@commander-js/extra-typings';
import { startViteServer, type ServerInfo } from '../browser/browser-utils-playwright.mts';
// ... other imports

interface ComparisonOptions {
  browser?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  debug?: boolean;
  timeout?: number;
  fidelity?: number;
  markers?: string;
  regressionThreshold?: number;
  cpuThrottleRate?: number;
  screenshot?: boolean;
  reuseControl?: boolean;
  reuseExperiment?: boolean;
}

const command = new Command()
  .name('setup-bench')
  .description('Compare Glimmer VM performance between branches using TracerBench')
  // ... options

async function runComparison(options: ComparisonOptions) {
  // Setup phase
  // Server start phase
  // TracerBench execution
  // Cleanup phase
}
```

## Benefits
1. **Consistency** - Uses same patterns as bench-quick.mts
2. **Reliability** - Better process management and cleanup
3. **Debuggability** - More logging and error context
4. **Extensibility** - Easier to add new features
5. **Maintainability** - Shared code reduces duplication

## Questions to Consider
1. Should we keep using TracerBench CLI or integrate its Node API?
2. Do we want to add visual regression testing alongside performance?
3. Should we support custom benchmark scenarios beyond krausest?
4. Do we need to preserve backward compatibility with existing scripts?

## Next Steps
1. Review and approve this plan
2. Implement Phase 1 (basic refactoring)
3. Test with existing workflows
4. Implement Phase 2 (CLI enhancement)
5. Consider Phase 3 based on needs