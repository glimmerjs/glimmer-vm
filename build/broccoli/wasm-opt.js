const Plugin = require('broccoli-plugin');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// WasmOptionally run the `wasm-opt` binary from
// https://github.com/WebAssembly/binaryen but it's not always installed
// everywhere or easy to install so try to gracfully handle the case where it
// can't be found and instead just skip this step.
class WasmOpt extends Plugin {
  build() {
    const filenames = fs.readdirSync(this.inputPaths[0]);
    for (const name of filenames) {
      const full_path = path.join(this.inputPaths[0], name);
      if (path.extname(name) !== '.wasm') {
        continue;
      }
      const filename = path.basename(name);
      const outputFile = path.join(this.outputPath, filename);
      const args = ["-Os", full_path, "-o", outputFile];

      try {
        execFileSync("wasm-opt", args);
      } catch (err) {
        if (err.code === "ENOENT") {
          break;
        }
        throw err;
      }
    }
  }
}

module.exports = function(inputPath) {
  return new WasmOpt([inputPath]);
}
