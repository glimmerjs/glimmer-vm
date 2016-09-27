var findLib = require('./find-lib');
var rollup = require('./rollup');

var name = 'simple-html-tokenizer';
var entry = name + '/index.js';
var dir = findLib(name, '../lib');

module.exports = rollup(dir, name, entry);
