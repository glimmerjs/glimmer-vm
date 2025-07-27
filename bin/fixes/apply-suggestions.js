#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync } from 'fs';

const filePath = process.argv[2];
const type = process.argv[3] || 'all'; // 'eslint', 'ts', or 'all'

if (!filePath || !existsSync(filePath)) {
  console.error('Usage: node apply-suggestions.js <file-path> [eslint|ts|all]');
  process.exit(1);
}

console.log(`Applying ${type} suggestions to ${filePath}\n`);

try {
  if (type === 'eslint' || type === 'all') {
    console.log('=== Applying ESLint suggestions ===');
    execSync(`node apply-eslint-suggestions.js "${filePath}"`, { stdio: 'inherit' });
    console.log();
  }

  if (type === 'ts' || type === 'all') {
    console.log('=== Applying TypeScript code fixes ===');
    execSync(`node apply-ts-codefixes.js "${filePath}"`, { stdio: 'inherit' });
    console.log();
  }

  console.log('Done!');
} catch (error) {
  console.error(
    'Error applying suggestions:',
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
}
