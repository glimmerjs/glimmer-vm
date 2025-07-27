#!/usr/bin/env node

import { ESLint } from 'eslint';
import { readFileSync, writeFileSync } from 'fs';

const [, , filePath, ruleFilter] = process.argv;

if (!filePath) {
  console.error('Usage: node apply-eslint-suggestions.js <file-path> [rule-id]');
  process.exit(1);
}

const eslint = new ESLint();
const [result] = await eslint.lintFiles([filePath]);

if (!result || !result.messages.length) {
  console.log('No issues found');
  process.exit(0);
}

let content = readFileSync(filePath, 'utf-8');
const messages = result.messages
  .filter((m) => !ruleFilter || m.ruleId === ruleFilter)
  .filter((m) => m.suggestions?.length)
  .sort((a, b) => {
    const aFix = a.suggestions?.[0]?.fix;
    const bFix = b.suggestions?.[0]?.fix;
    if (!aFix || !bFix) return 0;
    return bFix.range[0] - aFix.range[0];
  });

let changesMade = 0;

for (const message of messages) {
  const suggestion = message.suggestions?.[0];
  if (!suggestion?.fix) continue;
  const { fix } = suggestion;
  console.log(`Fixing ${message.ruleId} at line ${message.line}`);

  content = content.slice(0, fix.range[0]) + fix.text + content.slice(fix.range[1]);
  changesMade++;
}

if (changesMade > 0) {
  writeFileSync(filePath, content);
  console.log(`Applied ${changesMade} fixes`);
} else {
  console.log('No applicable suggestions found');
}
