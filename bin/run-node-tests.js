#!/usr/bin/env node

const path = require('path');
const execa = require('execa');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EMBER_BIN = `ember`;
const QUNIT_BIN = `qunit`
const NODE_TEST_GLOB = 'tests/node_modules/@glimmer/node/test/**/*-test.js';

// When running inside `ember test`, we already have a build we can use.
if ('EMBER_CLI_TEST_OUTPUT' in process.env) {
  process.chdir(process.env.EMBER_CLI_TEST_OUTPUT);
  exec(QUNIT_BIN, [NODE_TEST_GLOB]);
} else {
  // When running script directly, we need to build first to ensure we have
  // tests to run.
  process.chdir(PROJECT_ROOT);
  exec(EMBER_BIN, ['build']);
  exec(QUNIT_BIN, [`dist/${NODE_TEST_GLOB}`]);
}

function exec(command, args) {
  execa.sync(command, args, {
    stdio: 'inherit',
    preferLocal: true
  });
}
