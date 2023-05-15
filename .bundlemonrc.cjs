// @ts-check

const { mkdirSync } = require('node:fs');
const { Compression } = require('bundlemon-utils');

/** @typedef {import("bundlemon/lib/main/types").Config} Config */

mkdirSync('dist');

/** @type {Config} */
module.exports = {
  files: [{ path: 'packages/@glimmer/*/dist/*.production.js' }],
  defaultCompression: Compression.Brotli,
  reportOutput: [['json', { fileName: 'dist/bundlemon.json' }], 'github'],
};
