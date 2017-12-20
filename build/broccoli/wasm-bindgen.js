const Plugin = require('broccoli-plugin');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Run the `wasm-bindgen` binary from
// https://github.com/alexcrichton/wasm-bindgen to generate a TypeScript module
// from the wasm files passed in as input.
class WasmBindgen extends Plugin {
  build() {
    const filenames = fs.readdirSync(this.inputPaths[0]);
    for (const name of filenames) {
      const full_path = path.join(this.inputPaths[0], name);
      if (path.extname(name) !== '.wasm') {
        continue;
      }
      const filename = path.basename(name);
      const filestem = path.basename(name, '.wasm');
      const outputTs = path.join(this.outputPath, `${filestem}.ts`);
      const outputWasm = path.join(this.outputPath, filename);
      const args = [
        full_path,
        "--output-ts",
        outputTs,
        "--output-wasm",
        outputWasm,
      ];
      if (!this.production)
        args.push("--debug");

      execFileSync("wasm-bindgen", args);
    }
  }
}

module.exports = function(inputPath, production) {
  let pass = new WasmBindgen([inputPath]);
  pass.production = production;
  return pass;
}


