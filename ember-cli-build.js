/*jshint node:true*/
var path = require('path');
var fs = require('fs');
var funnel = require('broccoli-funnel');
var merge = require('broccoli-merge-trees');
var concat = require('broccoli-concat');
var typescript = require('broccoli-typescript-compiler').typescript;
var whatchanged = require('broccoli-whatchanged').default;
var writeFile = require('broccoli-file-creator');

var helpers = require('./build-support/generate-helpers');
var rollup = require('./build-support/rollup');
var funnelLib = require('./build-support/funnel-lib');
var toAMD = require('./build-support/to-amd');
var toES5 = require('./build-support/to-es5');
var loadWithInlineMap = require('./build-support/rollup-plugin-load-with-inline-map');

var PACKAGE_NAMES = [
  "glimmer",
  "glimmer-benchmarks",
  "glimmer-compiler",
  "glimmer-demos",
  "glimmer-node",
  "glimmer-object",
  "glimmer-object-reference",
  "glimmer-reference",
  "glimmer-runtime",
  "glimmer-test-helpers",
  "glimmer-util",
  "glimmer-wire-format",
  "glimmer-syntax"
];

var EXTERNAL = [
  "benchmark",
  "handlebars",
  "qunit",
  "simple-dom",
  "simple-html-tokenizer",
  "babel-helpers"
].concat(PACKAGE_NAMES);

var AMD_BUNDLES = {
  'glimmer-common': [
    'babel-helpers',
    'glimmer-object',
    'glimmer-object-reference',
    'glimmer-reference',
    'glimmer-util',
    'glimmer-wire-format',
  ],
  'glimmer-runtime': [
    'glimmer-runtime'
  ],
  'glimmer-tests': [
    'glimmer-test-helpers',
    'glimmer-tests'
  ],
  'glimmer-compiler': [
    'glimmer-syntax',
    'glimmer-compiler',
    'simple-html-tokenizer',
    'handlebars'
  ]
};

var PACKAGES_DIR = __dirname + '/packages';

module.exports = function (opts) {
  var packages = Object.create(null);
  var trees = [
    funnelLib('loader.js', {
      include: ['loader.js'],
      annotation: 'loader.js'
    })
  ];
  var src = funnel(PACKAGES_DIR, {
    include: [ '**/*.ts' ],
    annotation: 'packages source'
  });

  var es2015 = typescript(src, {
    tsconfig: {
      compilerOptions: {
        target: 'es2015',
        module: 'es2015',
        moduleResolution: 'node',
        experimentalDecorators: true,
        declaration: true,
        inlineSourceMap: true,
        inlineSources: true,
        newLine: 'LF',
        baseUrl: '.'
      }
    },
    annotation: 'packages es'
  });

  trees.push(funnel(es2015, {
    destDir: 'debug/es2015'
  }));

  var es = toES5(es2015, {
    sourceMap: 'inline'
  });
  var esLib = funnel(es, {
    include: [
      '*/index.*',
      '*/lib/**/*.*'
    ],
    annotation: 'packages es lib'
  });

  trees.push(funnel(es, {
    destDir: 'debug/es'
  }));

  var packages = Object.create(null);
  PACKAGE_NAMES.forEach(function (name) {
    var entry = name + '/index.js';
    var tree = rollup(esLib, name, entry, {
      plugins: [loadWithInlineMap()],
      external: EXTERNAL,
      sourceMap: true
    });
    packages[name] = funnelAMD(tree);
    trees.push(tree);
  });

  packages['glimmer-tests'] = toAMD(funnel(es, {
    include: ['glimmer-!(node)/tests/**/*.js'],
    annotation: 'tests es'
  }));

  var handlebars = require('./build-support/handlebars');
  packages['handlebars'] = funnelAMD(handlebars);
  trees.push(handlebars);

  var simpleHTMLTokenizer = require('./build-support/simple-html-tokenizer');
  packages['simple-html-tokenizer'] = funnelAMD(simpleHTMLTokenizer);
  trees.push(simpleHTMLTokenizer);

  var babelHelpers = writeFile('named-amd/babel-helpers.js', helpers('amd'));
  packages['babel-helpers'] = babelHelpers;
  trees.push(babelHelpers);
  trees.push(writeFile('node_modules/babel-helpers.js', helpers('cjs')));
  trees.push(writeFile('es6/babel-helpers.js', helpers('es')));

  trees.push(funnelLib('qunitjs', {
    include: ['qunit.js', 'qunit.css'],
    destDir: 'tests',
    annotation: 'tests/qunit.{js|css}'
  }));

  trees.push(funnelLib('benchmark', {
    include: ['benchmark.js'],
    destDir: 'bench',
    annotation: 'bench/benchmark.js'
  }));

  trees.push(funnel('bench', {
    include: ['*.html'],
    destDir: 'demos',
    annotation: 'demos/*.html'
  }));

  trees.push(funnel('tests', {
    include: ['*.html'],
    destDir: 'tests',
    annotation: 'tests/*.html'
  }));

  trees.push(funnel('bench', {
    include: ['*.html'],
    destDir: 'bench',
    annotation: 'bench/*.html'
  }));

  // DEBUG TREE SPLIT
  trees.push(funnel(es, {
    include: ['glimmer-node/tests/**/*.js'],
    annotation: 'node tests es6',
    destDir: 'debug/node-tests'
  }));

  // typings
  trees.push(merge([funnel(es, {
    include: [
      '*/index.d.ts',
      '*/lib/**/*.d.ts'
    ],
    annotation: 'generated declarations',
    destDir: 'typings'
  }), funnel(PACKAGES_DIR, {
    include: [
      'handlebars/*.d.ts',
      'simple-htmlbars-tokenizer/*.d.ts'
    ],
    annotation: 'static declarations',
    destDir: 'typings'
  })], {
    annotation: 'declarations'
  }));

  Object.keys(AMD_BUNDLES).forEach(function (bundleName) {
    trees.push(amdBundle(packages, bundleName));
  });

  return merge(trees, {
    annotation: 'dist'
  });
}

function funnelAMD(tree) {
  return funnel(tree, {
    include: [
      'named-amd/**/*.js',
      'named-amd/**/*.map'
    ],
    annotation: 'select named-amd'
  });
}

function amdBundle(packages, bundleName) {
  var trees = AMD_BUNDLES[bundleName].map(function (packageName) {
    return packages[packageName];
  });
  return concat(merge(trees, {
    annotation: bundleName
  }), {
    inputFiles: ['named-amd/**/*.js'],
    outputFile: '/bundles/' + bundleName + '.js',
    sourceMapConfig: {
      enabled: true,
      cache: null,
      sourceRoot: '/'
    },
    annotation: bundleName
  });
}

//   var benchmarkPath = __dirname + '/node_modules/benchmark';

//   if (existsSync(benchmarkPath)) {
//     benchmarkTrees.push(find(benchmarkPath, {
//       include: ['benchmark.js'],
//       destDir: 'bench'
//     }));
//   }

//   var demos = find(__dirname + '/demos', {
//     include: ['*.html'],
//     destDir: 'demos'
//   });

//   var simpleDOMPath = path.dirname(require.resolve('simple-dom'));
//   var simpleDOM = find(simpleDOMPath, {
//     include: ['simple-dom.js']
//   });
//   /*
//    * ES6 Build
//    */
//   var tokenizerPath = path.join(require.resolve('simple-html-tokenizer'), '..', '..', 'lib');
//   // TODO: WAT, why does { } change the output so much....
//   var HTMLTokenizer = find(tokenizerPath, { });

//   /*
//    * Anonymous AMD Build
//    */
//   var glimmerCommon = find(libTree, {
//     include: [
//       'glimmer/**/*.js',
//       'glimmer-object/**/*.js',
//       'glimmer-object-reference/**/*.js',
//       'glimmer-reference/**/*.js',
//       'glimmer-util/**/*.js',
//       'glimmer-wire-format/**/*.js'
//     ]
//   });

//   var glimmerRuntime = find(libTree, {
//     include: ['glimmer-runtime/**/*']
//   });

//   var glimmerCompiler = merge([
//     find(libTree, {
//       include: [
//         'glimmer-syntax/**/*.js',
//         'glimmer-compiler/**/*.js',
//         'simple-html-tokenizer/**/*.js',
//         'handlebars/**/*.js'
//       ]
//     })
//   ]);

//   var glimmerDemos = merge([
//     find(libTree, {
//       include: [
//         'glimmer-test-helpers/**/*.js',
//         'glimmer-demos/**/*.js',
//       ]
//     })
//   ]);

//   var glimmerBenchmarks = merge([
//     find(libTree, {
//       include: [
//         'glimmer-test-helpers/**/*.js',
//         'glimmer-benchmarks/**/*.js',
//       ]
//     })
//   ]);

//   var glimmerTests = merge([
//     transpiledTSLintTree,
//     find(jsTree, { include: ['*/tests/**/*.js'], exclude: ['glimmer-node/tests/**/*.js'] }),
//     find(jsTree, { include: ['glimmer-test-helpers/**/*.js'] })
//   ]);

//   glimmerTests = transpile(glimmerTests, babelOptions, 'glimmer-tests');

//   // Test Assets

//   var testHarnessTrees = [
//     find(__dirname + '/tests', {
//       srcDir: '/',
//       files: [ 'index.html' ],
//       destDir: '/tests'
//     })
//   ];

//   if (hasBower) {
//     testHarnessTrees.push(find(bower, {
//       srcDir: '/qunit/qunit',
//       destDir: '/tests'
//     }));
//   }

//   var testHarness = merge(testHarnessTrees);

//   glimmerCommon = concat(glimmerCommon, {
//     inputFiles: ['**/*.js'],
//     outputFile: '/amd/glimmer-common.amd.js',
//     sourceMapConfig: {
//       enabled: true,
//       cache: null,
//       sourceRoot: '/'
//     }
//   });

//   glimmerCompiler = concat(glimmerCompiler, {
//     inputFiles: ['**/*.js'],
//     outputFile: '/amd/glimmer-compiler.amd.js',
//     sourceMapConfig: {
//       enabled: true,
//       cache: null,
//       sourceRoot: '/'
//     }
//   });

//   glimmerRuntime = concat(glimmerRuntime, {
//     inputFiles: ['**/*.js'],
//     outputFile: '/amd/glimmer-runtime.amd.js',
//     sourceMapConfig: {
//       enabled: true,
//       cache: null,
//       sourceRoot: '/'
//     }
//   });

//   glimmerDemos = concat(glimmerDemos, {
//     inputFiles: ['**/*.js'],
//     outputFile: '/amd/glimmer-demos.amd.js',
//     sourceMapConfig: {
//       enabled: true,
//       cache: null,
//       sourceRoot: '/'
//     }
//   });

//   glimmerBenchmarks = concat(glimmerBenchmarks, {
//     inputFiles: ['**/*.js'],
//     outputFile: '/amd/glimmer-benchmarks.amd.js',
//     sourceMapConfig: {
//       enabled: true,
//       cache: null,
//       sourceRoot: '/'
//     }
//   });

//   glimmerTests = concat(glimmerTests, {
//     inputFiles: ['**/*.js'],
//     outputFile: '/amd/glimmer-tests.amd.js',
//     sourceMapConfig: {
//       enabled: true,
//       cache: null,
//       sourceRoot: '/'
//     }
//   });

//   var finalTrees = [
//     testHarness,
//     demos,
//     merge(benchmarkTrees),
//     glimmerCommon,
//     glimmerCompiler,
//     glimmerRuntime,
//     glimmerTests,
//     glimmerDemos,
//     glimmerBenchmarks,
//     cjsTree,
//     es5LibTree,
//     es6LibTree
//   ];

//   if (hasBower) {
//     var loader = find(__dirname + '/node_modules', {
//       srcDir: '/loader.js/lib/loader',
//       files: [ 'loader.js' ],
//       destDir: '/assets'
//     });

//     finalTrees.push(loader);
//   }

//   return merge(finalTrees);
// };
