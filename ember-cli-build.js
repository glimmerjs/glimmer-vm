/*jshint node:true*/
var path = require('path');
var fs = require('fs');
var funnel = require('broccoli-funnel');
var merge = require('broccoli-merge-trees');
var concat = require('broccoli-concat');
var typescript = require('broccoli-typescript-compiler').typescript;
var Rollup = require('broccoli-rollup');
var multiEntry = require('rollup-plugin-multi-entry');
var MagicString = require('magic-string');
var whatchanged = require('broccoli-whatchanged').default;

module.exports = function (opts) {
  var packagesDir = __dirname + '/packages';
  var src = funnel(packagesDir, {
    include: [
      "**/*.d.ts",
      "*/lib/**/*.ts",
      "*/index.ts"
    ],
    annotation: 'package source'
  });

  var js = typescript(src, {
    tsconfig: {
      "compilerOptions": {
        target: "es5",
        module: "es2015",
        noEmitHelpers: true,
        moduleResolution: "node",
        declaration: true,
        newLine: "LF",
        inlineSources: true,
        inlineSourceMap: true,
        baseUrl: "."
      }
    },
    annotation: "packages es6"
  });

  var declarations = funnel(js, {
    include: ["**/*.d.ts"],
    annotation: "generated declarations"
  });

  var tests = merge([
    funnel(packagesDir, {
      include: [
        "**/*.d.ts",
        "*/tests/**/*.ts"
      ],
      exclude: [
        "glimmer-node/*"
      ],
      annotation: "tests source"
    }),
    declarations
  ], {
    annotation: "tests source"
  });
  tests = typescript(tests, {
    tsconfig: {
      compilerOptions: {
        target: "es5",
        module: "amd",
        moduleResolution: "node",
        newLine: "LF",
        inlineSources: true,
        inlineSourceMap: true,
        baseUrl : ".",
        outFile: "named-amd/glimmer-tests.js"
      },
      include: ["qunit/*", "**/tests/*"],
      exclude: ["glimmer-node"]
    },
    annotation: "tests amd"
  });

  var nodeTests = merge([
    funnel(packagesDir, {
      include: [
        "**/*.d.ts",
        "glimmer-node/tests/**/*.ts"
      ],
      annotation: "tests source"
    }),
    declarations
  ], {
    annotation: "node tests source"
  });
  nodeTests = typescript(nodeTests, {
    tsconfig: {
      compilerOptions: {
        target: "es5",
        module: "commonjs",
        moduleResolution: "node",
        newLine: "LF",
        inlineSources: true,
        inlineSourceMap: true,
        baseUrl : ".",
        outDir: "node_modules"
      },
      include: ["qunit/*", "**/tests/*"]
    },
    annotation: "node tests cjs"
  });

  var handlebars = buildLib('handlebars', 'handlebars/compiler/base.js', '.');
  var simpleHTMLTokenizer = buildLib('simple-html-tokenizer', 'simple-html-tokenizer/index.js', '../lib');

  var trees = [
    tests,
    nodeTests,
    funnel('bench', {
      include: ['*.html'],
      destDir: 'bench'
    }),
    funnel('demos', {
      include: ['*.html'],
      destDir: 'demos'
    }),
    funnel('tests', {
      include: ['*.html'],
      destDir: 'tests'
    }),
    qunit('tests'),
    funnel(path.dirname(require.resolve('loader.js')), {
      files: ['loader.js']
    }),
    handlebars,
    simpleHTMLTokenizer
  ];

  var packageNames = [
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

  var external = [
    "benchmark",
    "handlebars",
    "qunit",
    "simple-dom",
    "simple-html-tokenizer"
  ].concat(packageNames);

  var packages = Object.create(null);
  packageNames.forEach(function (packageName) {
    var tree = buildPackage(js, packageName, external);
    packages[packageName] = tree;
    trees.push(tree);
  });

  packages['handlebars'] = handlebars;
  packages['simple-html-tokenizer'] = simpleHTMLTokenizer;
  packages['glimmer-tests'] = tests;

  trees.push(bundle(amdTrees(packages, [
    'glimmer-object',
    'glimmer-object-reference',
    'glimmer-reference',
    'glimmer-util',
    'glimmer-wire-format',
  ]), 'glimmer-common'));

  trees.push(bundle(amdTrees(packages, [
    'glimmer-syntax',
    'glimmer-compiler',
    'simple-html-tokenizer',
    'handlebars'
  ]), 'glimmer-compiler'));

  trees.push(bundle(amdTrees(packages, [
    'glimmer-runtime'
  ]), 'glimmer-runtime'));

  trees.push(bundle(amdTrees(packages, [
    'glimmer-test-helpers',
    'glimmer-tests'
  ]), 'glimmer-tests'));

  return merge(trees, {
    annotation: 'dist'
  });
}

function amdTrees(packages, packageNames) {
  return packageNames.map(function (packageName) {
    return funnel(packages[packageName], {
      include: [
        'named-amd/**/*.js',
        'named-amd/**/*.map'
      ]
    });
  });
}

function bundle(amdTrees, bundleName) {
  return concat(merge(amdTrees, {
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

function buildLib(name, entry, libPath) {
  var dir = path.resolve(path.dirname(require.resolve(name)), libPath);
  return new Rollup(dir, {
    rollup: {
      entry: entry,
      plugins: [{
        load: function (id) {
          if (/handlebars\/utils.js$/.test(id)) {
            let code = fs.readFileSync(id, 'utf8');
            code = code.replace(/export var isFunction/, "export { isFunction }");
            return {
              code: code,
              map: { mappings: null }
            }
          }
        }
      }],
      targets: [{
        format: 'cjs',
        dest: 'node_modules/' + name + '/index.js'
      }, {
        format: 'amd',
        moduleId: name,
        dest: 'named-amd/' + name + '.js'
      }, {
        format: 'es',
        dest: 'es6/' + name + '.js'
      }]
    },
    annotation: name
  });
}

function buildPackage(esTree, packageName, external) {
  var entry = packageName + '/index.js';
  return new Rollup(esTree, {
    rollup: {
      plugins: [extractInlineSourceMap()],
      entry: entry,
      external: external,
      sourceMap: true,
      targets: [{
        format: 'cjs',
        dest: 'node_modules/' + packageName + '/index.js'
      }, {
        format: 'amd',
        moduleId: packageName,
        dest: 'named-amd/' + packageName + '.js'
      }, {
        format: 'es',
        dest: 'es6/' + packageName + '.js'
      }]
    }
  });
}

var SOURCEMAP_DATA = 'sourceMappingURL=data:application/json;base64,'
function extractInlineSourceMap() {
  return {
    load: function (id) {
      var code = fs.readFileSync(id, 'utf8');
      var index = code.lastIndexOf(SOURCEMAP_DATA);
      var map;
      if (index > -1) {
        var base64 = code.slice(index + SOURCEMAP_DATA.length);
        var json = new Buffer(base64, 'base64').toString('utf8')
        map = JSON.parse(json);
      }
      return { code: code, map: map };
    }
  };
}

function qunit(destDir) {
  var qunitjs = require.resolve('qunitjs');
  return funnel(path.dirname(qunitjs), {
    files: ['qunit.js', 'qunit.css'],
    destDir: destDir,
    annotation: 'qunit.{js|css}'
  });
}

function inlineModules(entry, include) {
  let root;
  return {
    resolveId: function (importee, importer) {
      if (importer === undefined) {
        root = importee.slice(0, -entry.length);
      } else if (include.indexOf(importee) > -1) {
        return root + importee + '/index.js';
      }
    }
  };
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
