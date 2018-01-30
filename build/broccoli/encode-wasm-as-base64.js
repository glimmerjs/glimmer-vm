const Plugin = require('broccoli-plugin');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

class EncodeWasmAsBase64 extends Plugin {
  build() {
    const filenames = fs.readdirSync(this.inputPaths[0]);
    for (const name of filenames) {
      const fullPath = path.join(this.inputPaths[0], name);
      if (path.extname(name) !== '.wasm') {
        continue;
      }
      const outputJs = `${path.basename(name, '.wasm')}.js`;
      const args = [
        fullPath,
        "-o",
        path.join(this.outputPath, outputJs),
        "--typescript",
        "--base64",
      ];

      execFileSync("wasm2es6js", args);
    }
  }
}

module.exports = function(inputPath) {
  return new EncodeWasmAsBase64([inputPath]);
}
