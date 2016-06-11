/* jshint node: true */
/* jscs: disable */
/* globals __dirname */

var path = require('path');
var existsSync = require('exists-sync');
var concat = require('broccoli-concat');
var merge = require('broccoli-merge-trees');
var typescript = require('broccoli-typescript-compiler');
var transpileES6 = require('emberjs-build/lib/utils/transpile-es6');
var handlebarsInlinedTrees = require('./build-support/handlebars-inliner');
var stew = require('broccoli-stew');
var mv = stew.mv;
var find = stew.find;

function transpile(tree, label) {
  return transpileES6(tree, label, { sourceMaps: 'inline' });
}

module.exports = function() {
  var packages = __dirname + '/packages';
  var bower = __dirname + '/bower_components';
  var hasBower = existsSync(bower);

  var tsOptions = {
    tsconfig: {
      compilerOptions: {
        target: "es2015",
        inlineSourceMap: true,
        inlineSources: true,
        moduleResolution: "node",

        /* needed to get typescript to emit the desired sourcemaps */
        rootDir: '.',
        mapRoot: '/'
      }
    }
  };

  var demoTrees = [
    find(__dirname + '/demos', {
      include: ['*.html'],
      destDir: 'demos'
    }),
    find(__dirname + '/bench', {
      include: ['*.html'],
      destDir: 'demos'
    })
  ];

  var benchmarkPath = __dirname + '/node_modules/benchmark';
  if (existsSync(benchmarkPath)) {
    demoTrees.push(find(benchmarkPath, {
      include: ['benchmark.js'],
      destDir: 'demos'
    }));
  }
  var demos = merge(demoTrees);

  var tokenizerPath = path.join(require.resolve('simple-html-tokenizer'), '..', '..', 'lib');
  // TODO: WAT, why does { } change the output so much....
  var HTMLTokenizer = find(tokenizerPath, { });

  var tsTree = find(packages, {
    include: ['**/*.ts'],
    exclude: ['**/*.d.ts']
  });

  var jsTree = typescript(tsTree, tsOptions);

  var libTree = find(jsTree, {
    include: ['*/index.js', '*/lib/**/*.js']
  });
  libTree = merge([libTree, HTMLTokenizer, handlebarsInlinedTrees.compiler]);

  var es6LibTree = mv(libTree, 'es6');
  libTree = transpile(libTree, 'ES5 Lib Tree');
  var es5LibTree = mv(libTree, 'named-amd');

  var glimmerCommon = find(libTree, {
    include: [
      'glimmer/**/*.js',
      'glimmer-object/**/*.js',
      'glimmer-object-reference/**/*.js',
      'glimmer-reference/**/*.js',
      'glimmer-util/**/*.js',
      'glimmer-wire-format/**/*.js'
    ]
  });

  var glimmerRuntime = find(libTree, {
    include: ['glimmer-runtime/**/*']
  });

  var glimmerCompiler = merge([
    find(libTree, {
      include: [
        'glimmer-syntax/**/*.js',
        'glimmer-compiler/**/*.js',
        'simple-html-tokenizer/**/*.js',
        'handlebars/**/*.js'
      ]
    })
  ]);

  var glimmerDemos = merge([
    find(libTree, {
      include: [
        'glimmer-test-helpers/**/*.js',
        'glimmer-demos/**/*.js',
      ]
    })
  ]);

  var glimmerTests = merge([
    find(jsTree, { include: ['*/tests/**/*.js'] }),
    find(jsTree, { include: ['glimmer-test-helpers/**/*.js'] })
  ]);

  glimmerTests = transpile(glimmerTests, 'glimmer-tests');

  // Test Assets

  var testHarnessTrees = [
    find(__dirname + '/tests', {
      srcDir: '/',
      files: [ 'index.html' ],
      destDir: '/tests'
    })
  ];

  if (hasBower) {
    testHarnessTrees.push(find(bower, {
      srcDir: '/qunit/qunit',
      destDir: '/tests'
    }));
  }

  var testHarness = merge(testHarnessTrees);

  glimmerCommon = concat(glimmerCommon, {
    inputFiles: ['**/*.js'],
    outputFile: '/amd/glimmer-common.amd.js',
    sourceMapConfig: {
      enabled: true,
      cache: null,
      sourceRoot: '/'
    }
  });

  glimmerCompiler = concat(glimmerCompiler, {
    inputFiles: ['**/*.js'],
    outputFile: '/amd/glimmer-compiler.amd.js',
    sourceMapConfig: {
      enabled: true,
      cache: null,
      sourceRoot: '/'
    }
  });

  glimmerRuntime = concat(glimmerRuntime, {
    inputFiles: ['**/*.js'],
    outputFile: '/amd/glimmer-runtime.amd.js',
    sourceMapConfig: {
      enabled: true,
      cache: null,
      sourceRoot: '/'
    }
  });

  glimmerDemos = concat(glimmerDemos, {
    inputFiles: ['**/*.js'],
    outputFile: '/amd/glimmer-demos.amd.js',
    sourceMapConfig: {
      enabled: true,
      cache: null,
      sourceRoot: '/'
    }
  });

  glimmerTests = concat(glimmerTests, {
    inputFiles: ['**/*.js'],
    outputFile: '/amd/glimmer-tests.amd.js',
    sourceMapConfig: {
      enabled: true,
      cache: null,
      sourceRoot: '/'
    }
  });

  var finalTrees = [
    testHarness,
    demos,
    glimmerCommon,
    glimmerCompiler,
    glimmerRuntime,
    glimmerTests,
    glimmerDemos,
    es5LibTree,
    es6LibTree
  ];

  if (hasBower) {
    var loader = find(bower, {
      srcDir: '/loader.js',
      files: [ 'loader.js' ],
      destDir: '/assets'
    });

    finalTrees.push(loader);

    var compiler = concat(merge([loader, glimmerCommon, glimmerCompiler]), {
      header: 'function enifed() { define.apply(undefined, arguments); }\n',
      headerFiles: ['assets/loader.js'],
      inputFiles: ['amd/glimmer-*.amd.js'],
      outputFile: '/node/precompiler/index.js',
      footer: 'module.exports = require("glimmer-compiler").compileSpec;'
    });

    finalTrees.push(compiler);
  }

  return merge(finalTrees);
};
