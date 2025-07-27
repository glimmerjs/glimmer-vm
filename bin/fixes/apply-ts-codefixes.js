#!/usr/bin/env node

import ts from 'typescript';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';

const [, , fileName, errorCode] = process.argv;

if (!fileName) {
  console.error('Usage: node apply-ts-codefixes.js <file-path> [error-code]');
  process.exit(1);
}

const resolvedFileName = resolve(fileName);

// Find and parse tsconfig
const configPath = ts.findConfigFile(dirname(resolvedFileName), ts.sys.fileExists, 'tsconfig.json');
if (!configPath) {
  console.error('Could not find tsconfig.json');
  process.exit(1);
}

const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
const { options } = ts.parseJsonConfigFileContent(config, ts.sys, dirname(configPath));

// Create program and get diagnostics
const program = ts.createProgram([resolvedFileName], options);
const sourceFile = program.getSourceFile(resolvedFileName);
if (!sourceFile) {
  console.error(`Could not load source file: ${resolvedFileName}`);
  process.exit(1);
}

const diagnostics = [
  ...program.getSemanticDiagnostics(sourceFile),
  ...program.getSyntacticDiagnostics(sourceFile),
].filter((d) => !errorCode || d.code === parseInt(errorCode));

if (!diagnostics.length) {
  console.log('No applicable TypeScript diagnostics found');
  process.exit(0);
}

// Create minimal language service
const languageService = ts.createLanguageService({
  getCompilationSettings: () => options,
  getScriptFileNames: () => [resolvedFileName],
  getScriptVersion: () => '1',
  getScriptSnapshot: (name) =>
    name === resolvedFileName
      ? ts.ScriptSnapshot.fromString(readFileSync(name, 'utf-8'))
      : undefined,
  getCurrentDirectory: () => process.cwd(),
  getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
  readFile: ts.sys.readFile,
  fileExists: ts.sys.fileExists,
});

// Get all code fixes
const allChanges = [];

for (const diagnostic of diagnostics) {
  if (diagnostic.file && diagnostic.start !== undefined) {
    const fixes = languageService.getCodeFixesAtPosition(
      resolvedFileName,
      diagnostic.start,
      diagnostic.start + (diagnostic.length || 1),
      [diagnostic.code],
      {},
      {}
    );

    if (fixes.length > 0) {
      console.log(`Found fix for TS${diagnostic.code}: ${diagnostic.messageText}`);
      console.log(`  Fix: ${fixes[0]?.description}`);

      allChanges.push(...(fixes[0]?.changes.flatMap((c) => c.textChanges) || []));
    }
  }
}

if (!allChanges.length) {
  console.log('No applicable code fixes found');
  process.exit(0);
}

// Apply changes (sorted in reverse order by position)
let content = readFileSync(resolvedFileName, 'utf-8');
allChanges
  .sort((a, b) => b.span.start - a.span.start)
  .forEach((change) => {
    content =
      content.slice(0, change.span.start) +
      change.newText +
      content.slice(change.span.start + change.span.length);
  });

writeFileSync(resolvedFileName, content);
console.log(`Applied ${allChanges.length} TypeScript code fixes`);
