// @ts-check

const { mkdirSync, existsSync } = require('node:fs');
const { Compression } = require('bundlemon-utils');

/** @typedef {import("bundlemon/lib/main/types").Config} Config */

if (!existsSync('dist')) mkdirSync('dist');

/** @type {Config} */
module.exports = {
  baseDir: __dirname,
  files: [{ path: 'packages/@glimmer/*/dist/*.production.js' }],
  defaultCompression: Compression.Brotli,
  includeCommitMessage: true,
  reportOutput: [
    ['json', { fileName: 'dist/bundlemon.json' }],
    ['github', { checkRun: true, commitStatus: true, prComment: true }],
  ],
};
