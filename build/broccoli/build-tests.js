'use strict';

const path = require('path');
const merge = require('broccoli-merge-trees');
const funnel = require('broccoli-funnel');
const concat = require('broccoli-concat');
const babel = require('broccoli-babel-transpiler');
const transpileToES5 = require('./transpile-to-es5');

/**
 * For development, this returns a Broccoli tree with:
 *
 * 1. All of Glimmer's AMD modules, concatenated into glimmer-vm.js.
 * 2. Test files as AMD modules.
 * 3. A test harness, including HTML page, QUnit, dependencies, etc.
 */
module.exports = function (jsTree, packagesTree) {
  let browserTests = merge([
    transpileBrowserTestsToAMD(jsTree),
    includeGlimmerAMD(packagesTree),
    includeVendorDependencies(),
    includeTestHarness(),
  ]);

  browserTests = funnel(browserTests, {
    destDir: 'tests',
  });

  let nodeTests = transpileNodeTestsToCommonJS(jsTree);

  return merge([browserTests, nodeTests]);
};

function transpileBrowserTestsToAMD(jsTree) {
  let testTree = funnel(jsTree, {
    include: ['@glimmer/!(node)/test/**/*.js'],
  });

  testTree = transpileToES5(testTree, 'amd');

  return concat(testTree, {
    outputFile: 'assets/tests.js',
  });
}

function transpileNodeTestsToCommonJS(jsTree) {
  let testTree = funnel(jsTree, {
    include: ['@glimmer/**/test/**/*.js'],
  });

  return babel(testTree, {
    sourceMaps: 'inline',
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
}

function includeGlimmerAMD(packages) {
  let libAMD = funnel(packages, {
    include: ['@glimmer/*/dist/amd/es5/*.js'],
  });

  return concat(libAMD, {
    outputFile: 'assets/glimmer-vm.js',
  });
}

function includeVendorDependencies() {
  let simpleHTMLTokenizer = funnel('node_modules/simple-html-tokenizer/dist/es6', {
    destDir: 'simple-html-tokenizer',
  });

  let handlebars = funnel('node_modules/@handlebars/parser/dist/esm', {
    destDir: '@handlebars/parser',
  });

  let transpiled = transpileToES5(merge([simpleHTMLTokenizer, handlebars]), 'amd');

  let simpleDOM = funnel('node_modules/@simple-dom', {
    include: ['*/dist/amd/es5/*.{js,map}'],
  });

  return concat(merge([transpiled, simpleDOM]), {
    inputFiles: ['**/*.js'],
    outputFile: 'assets/vendor.js',
  });
}

function includeTestHarness() {
  let html = funnel('test', {
    include: ['index.html'],
  });

  let loaderPath = path.parse(require.resolve('loader.js'));
  let loader = funnel(loaderPath.dir, {
    files: [loaderPath.base],
    destDir: '/assets',
  });

  let qunit = funnel(path.join(require.resolve('qunit'), '..'), {
    destDir: 'assets/',
  });

  let harnessTrees = [html, loader, qunit];

  return merge(harnessTrees);
}
