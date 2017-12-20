const Plugin = require('broccoli-plugin');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Run the `wasm-gc` program from https://github.com/alexcrichton/wasm-gc over
// any wasm files in the tree provided as input.
class WasmGc extends Plugin {
  build() {
    const filenames = fs.readdirSync(this.inputPaths[0]);
    for (const name of filenames) {
      const full_path = path.join(this.inputPaths[0], name);
      if (path.extname(name) !== '.wasm') {
        continue;
      }
      const filename = path.basename(name);
      const outputFile = path.join(this.outputPath, filename);
      const args = [full_path, outputFile];
      execFileSync("wasm-gc", args);
    }
  }
}

module.exports = function(inputPath) {
  return new WasmGc([inputPath]);
}
