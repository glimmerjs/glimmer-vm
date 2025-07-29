# Glimmer VM Benchmarks

This directory contains performance benchmarks for Glimmer VM, including the Krausest benchmark implementation.

## Quick Start

### First Time Setup

Before running benchmarks, you need to prepare the benchmark packages:

```bash
pnpm benchmark:setup
```

This command:
- Builds all Glimmer packages into tarballs
- Places them in `benchmark/benchmarks/krausest/packages/` (gitignored)
- Updates the benchmark's package.json to use these tarballs
- Ensures the benchmark uses the exact same packages that would be published to npm

### Running Benchmarks

After setup, you can run benchmarks:

```bash
# Quick local benchmark (opens in browser)
pnpm benchmark:quick

# Quick benchmark in headless mode (takes screenshot)
pnpm benchmark:quick --headless

# Full TracerBench comparison between branches
pnpm benchmark:run
```

## Architecture

The benchmark setup is designed to:

1. **Isolate from workspace** - The benchmark is intentionally NOT part of the pnpm workspace
2. **Use production builds** - Uses `pnpm pack` to create tarballs, exactly like npm publishing
3. **Respect publishConfig** - Honors all package.json publishing settings
4. **Enable accurate comparison** - Ensures control and experiment use identical benchmark code

## Development Workflow

When developing Glimmer VM:

1. Make your changes to the Glimmer packages
2. Run `pnpm benchmark:setup` to rebuild the benchmark packages
3. Run `pnpm benchmark:run` to test performance

The benchmark packages are only rebuilt when you explicitly run `benchmark:setup`, not on every `pnpm install`.

## TracerBench Comparison

The `benchmark:run` command sets up a full A/B comparison:

- **Control**: Builds packages from the main branch
- **Experiment**: Uses your current branch's packages
- **Same benchmark code**: Both use the benchmark source from your current branch

This ensures you're comparing only the Glimmer VM changes, not benchmark changes.

## Environment Variables

- `REUSE_CONTROL` - Skip rebuilding control branch
- `REUSE_EXPERIMENT` - Skip rebuilding experiment branch
- `CONTROL_BRANCH_NAME` - Control branch (default: main)
- `EXPERIMENT_BRANCH_NAME` - Experiment branch (default: current HEAD)
- `MARKERS` - TracerBench markers to measure
- `FIDELITY` - TracerBench fidelity (default: 20)
- `THROTTLE` - CPU throttle rate (default: 2)

## Troubleshooting

If you see "Benchmark packages not found!" error:
```bash
pnpm benchmark:setup
```

To clean and rebuild everything:
```bash
rm -rf benchmark/benchmarks/krausest/packages
pnpm benchmark:setup
```