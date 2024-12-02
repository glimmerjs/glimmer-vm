#!/usr/bin/env node
import { rimraf } from 'rimraf';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    preserve: new Set(),
    help: false,
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--preserve':
        const value = args[++i];
        if (!value || value.startsWith('--')) {
          console.error('Error: --preserve requires a value (node-modules, turbo, or both)');
          process.exit(1);
        }
        const items = value.split(',');
        for (const item of items) {
          if (!['node-modules', 'turbo'].includes(item)) {
            console.error(`Error: Invalid preserve value: ${item}. Must be 'node-modules' or 'turbo'`);
            process.exit(1);
          }
          options.preserve.add(item);
        }
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        console.warn(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Usage: clean.mjs [options]

Options:
  --preserve <items>      Skip cleaning specified items (comma-separated)
                         Valid values: node-modules, turbo
                         Example: --preserve node-modules,turbo
  --dry-run              Show what would be deleted without actually deleting
  --help, -h             Show this help message

Description:
  Cleans build artifacts and dependencies from the project.
  By default removes dist, .turbo, and node_modules directories.
`);
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  const patterns = ['**/dist/'];
  if (!options.preserve.has('node-modules')) patterns.push('**/node_modules/');
  if (!options.preserve.has('turbo')) patterns.push('**/.turbo/');

  const glob = `{${patterns.join(',')}}`;

  if (options.dryRun) {
    console.log('Would delete the following pattern:', glob);
    process.exit(0);
  }

  try {
    await rimraf(glob, { glob: true });
    console.log('Clean completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
