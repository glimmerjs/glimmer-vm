/*jshint node:true*/

const merge = require('broccoli-merge-trees');
const funnel = require('broccoli-funnel');
const { typescript } = require('broccoli-typescript-compiler');
const compileRust = require('./build/broccoli/compile-rust');
const wasmGc = require('./build/broccoli/wasm-gc');
const wasmOpt = require('./build/broccoli/wasm-opt');
const wasmBindgen = require('./build/broccoli/wasm-bindgen');
const encodeWasmAsBase64 = require('./build/broccoli/encode-wasm-as-base64');

const buildTests = require('./build/broccoli/build-tests');
const buildPackages = require('./build/broccoli/build-packages.js');
const mergeDefinitionFiles = require('./build/broccoli/merge-definition-files');
const stripGlimmerUtilities = require('./build/broccoli/strip-glimmer-utilities');
const writeSmokeTest = require('./build/broccoli/write-smoke-test');

const PRODUCTION = process.env.EMBER_ENV === 'production';

/**
 * For development, we build for ES5 AMD (browser tests) and CommonJS (Node
 * tests). For production builds, we omit tests but include all target
 * formats.
 */
module.exports = function(_options) {
  // First, get all of our TypeScript packages while preserving their relative
  // path in the filesystem. This is important because tsconfig.json paths are
  // relative to the project root and we want to use the tsconfig as-is.
  let tsTree = funnel('packages/@glimmer', {
    destDir: 'packages/@glimmer'
  });

  // Next up let's handle the Rust code which we'll compile to wasm. There's a
  // few discreet steps here that we're doing:
  //
  // * First up we actually compile the rust code. This will emit one file, a
  //   wasm file
  // * Next we do some postprocessing on this wasm file, executing tools like
  //   `wasm-gc` and `wasm-opt` to make it a little smaller.
  // * After that we execute `wasm-bindgen` which will read the wasm file and
  //   generate a typescript module corresponding to what the wasm exposes.
  // * Finally we'll do a "poor man's include" of the wasm into the JS module
  //   system by creating a module that simply contains the base64 encoded
  //   string of the wasm module itself.
  //
  // These are then all weaved below to the right location to ensure everything
  // matches up.c
  let wasmTree = compileRust('packages/@glimmer/low-level/rust', PRODUCTION);
  wasmTree = wasmGc(wasmTree);
  if (PRODUCTION)
    wasmTree = wasmOpt(wasmTree);
  wasmTree = wasmBindgen(wasmTree);
  let wasmAsBase64 = encodeWasmAsBase64(wasmTree);
  wasmTree = merge([wasmTree, wasmAsBase64]);

  // The base64 encoding will emit a `*.d.ts` file which describes the JS
  // interface of the wasm module, so let's pull that in to feed it into
  // typescript.
  let wasmTypeDefinitions = funnel(wasmTree, {
    destDir: 'packages/@glimmer/low-level/lib',
  });
  tsTree = merge([tsTree, wasmTypeDefinitions]);

  // Second, compile all of the TypeScript into ES2017 JavaScript. Because the
  // TypeScript compiler understands the project as a whole, it's faster to do
  // this once and use the transpiled JavaScript as the input to any further
  // transformations.
  let jsTree = typescript(tsTree);

  // The base64 encoding step *also* emitted a `*.js` file which is what we
  // actually want in terms of compiling it all together, so let's pull that
  // into the output of the typescript tree to make sure the module can
  // actually get resolved!
  let wasmRuntimeFiles = funnel(wasmAsBase64, {
    destDir: '@glimmer/low-level/lib',
  });
  jsTree = merge([jsTree, wasmRuntimeFiles]);

  // The TypeScript compiler doesn't emit `.d.ts` files, so we need to manually
  // merge them back into our JavaScript output.
  jsTree = mergeDefinitionFiles(jsTree);

  // Glimmer includes a number of assertions and logging information that can be
  // stripped from production builds for better runtime performance.
  if (PRODUCTION) {
    if (!process.env.RETAIN_FLAGS) {
      jsTree = funnel(jsTree, {
        exclude: ['**/**/-debug-strip.js']
      });
    }
    jsTree = stripGlimmerUtilities(jsTree);
  }

  let matrix;

  if (PRODUCTION) {
    matrix = [
      ['amd', 'es5'],
      ['commonjs', 'es2017'],
      ['commonjs', 'es5'],
      ['modules', 'es2017'],
      ['modules', 'es5'],
      ['types']
    ];
  } else {
    matrix = [
      ['amd', 'es5'],
      ['commonjs', 'es5'],
      ['modules', 'es2017'],
      ['types']
    ];
  }

  // Third, build our module/ES combinations for each package.
  let packagesTree = buildPackages(jsTree, matrix);

  let output;

  // Unless we're in production, bundle the tests and test harness. We'll also
  // grab the AMD build of Glimmer and concatenate it into a single
  // glimmer-vm.js file.
  if (PRODUCTION) {
    let smokeTestTree = writeSmokeTest(packagesTree);
    output = [packagesTree, smokeTestTree];
  } else {
    let testsTree = buildTests(tsTree, jsTree, packagesTree);
    output = [packagesTree, testsTree];
  }

  return merge(output);
}
