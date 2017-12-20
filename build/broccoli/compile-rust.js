const Plugin = require('broccoli-plugin');
const glob = require('glob');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const parseToml = require("toml").parse;

/**
 * Writes a TypeScript file that imports each package. This file can be passed
 * to the TypeScript compiler during testing to verify the types are resolving
 * correctly.
 */
class Rust extends Plugin {
  build() {
    const args = [
      "build",
      "--target", "wasm32-unknown-unknown"];
    let config = "debug";

    if (this.production) {
      config = "release";
      args.push("--release");
    }

    execFileSync("cargo", args, {
      cwd: this.inputPaths[0],
      env: Object.assign({}, process.env, {
        CARGO_TARGET_DIR: this.cachePath,
      }),
    });

    const name = this.crateName();
    const cargoOutput = path.join(this.cachePath, "wasm32-unknown-unknown", config, `${name}.wasm`);
    const wasm = fs.readFileSync(cargoOutput);
    const outputFile = path.join(this.outputPath, `${name}.wasm`);
    fs.writeFileSync(outputFile, wasm);
  }

  crateName() {
    return this.cargoConfig().package.name;
  }

  cargoConfig() {
    const configFile = path.join(this.inputPaths[0], "Cargo.toml");
    const config = fs.readFileSync(configFile, "utf8");
    return parseToml(config);
  }
}

module.exports = function(inputPath, production) {
  let rust = new Rust([inputPath]);
  rust.production = production;
  return rust;
}
