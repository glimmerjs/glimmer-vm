#!/usr/bin/env node

import { ESLint } from 'eslint';

/**
 * @param {string} filePath
 */
async function listESLintFixes(filePath) {
  const eslint = new ESLint();
  const results = await eslint.lintFiles([filePath]);

  console.log('=== ESLint Issues with Available Fixes ===\n');

  for (const result of results) {
    const messages = result.messages;

    if (messages.length === 0) {
      console.log('No ESLint issues found');
      continue;
    }

    const fixableByAutoFix = messages.filter((m) => m.fix);
    const fixableBySuggestions = messages.filter((m) => m.suggestions && m.suggestions.length > 0);
    const notFixable = messages.filter(
      (m) => !m.fix && (!m.suggestions || m.suggestions.length === 0)
    );

    console.log(`Total issues: ${messages.length}`);
    console.log(`  - Auto-fixable (--fix): ${fixableByAutoFix.length}`);
    console.log(`  - Fixable by suggestions: ${fixableBySuggestions.length}`);
    console.log(`  - Not auto-fixable: ${notFixable.length}\n`);

    if (fixableByAutoFix.length > 0) {
      console.log('Auto-fixable issues:');
      for (const msg of fixableByAutoFix) {
        console.log(`  - Line ${msg.line}:${msg.column} - ${msg.ruleId}: ${msg.message}`);
      }
      console.log();
    }

    if (fixableBySuggestions.length > 0) {
      console.log('Issues with suggestions:');
      for (const msg of fixableBySuggestions) {
        console.log(`  - Line ${msg.line}:${msg.column} - ${msg.ruleId}: ${msg.message}`);
        for (const suggestion of msg.suggestions || []) {
          console.log(`    → ${suggestion.desc}`);
        }
      }
      console.log();
    }

    if (notFixable.length > 0) {
      console.log('Not auto-fixable:');
      for (const msg of notFixable) {
        console.log(`  - Line ${msg.line}:${msg.column} - ${msg.ruleId}: ${msg.message}`);
      }
    }
  }
}

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node list-available-fixes.js <file-path>');
  process.exit(1);
}

listESLintFixes(filePath).catch(console.error);
