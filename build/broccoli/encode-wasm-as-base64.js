const Plugin = require('broccoli-plugin');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Encodes all wasm files as base64 and creates a corresponding typescript file
// which exports their contents.
class EncodeWasmAsBase64 extends Plugin {
  build() {
    const filenames = fs.readdirSync(this.inputPaths[0]);
    for (const name of filenames) {
      const full_path = path.join(this.inputPaths[0], name);
      if (path.extname(name) !== '.wasm') {
        continue;
      }

      const filestem = path.basename(name, '.wasm');
      const outputTs = path.join(this.outputPath, `${filestem}-contents.d.ts`);
      const outputJs = path.join(this.outputPath, `${filestem}-contents.js`);
      const wasm = fs.readFileSync(full_path);
      const base64 = wasm.toString("base64");

      fs.writeFileSync(outputTs, `
          /* tslint:disable*/
          declare const contents: Promise<Uint8Array>;
          export default contents;
      `);

      fs.writeFileSync(outputJs, `
          const toBuffer = typeof Buffer === 'undefined' ?
            (str) => Uint8Array.from(atob(str), c => c.charCodeAt(0)) :
            (str) => Buffer.from(str, 'base64');
          const contents = toBuffer("${base64}");
          export default Promise.resolve(contents);
      `);
    }
  }
}

module.exports = function(inputPath) {
  return new EncodeWasmAsBase64([inputPath]);
}
