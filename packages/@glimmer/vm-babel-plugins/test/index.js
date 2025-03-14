const path = require('node:path');
const pluginTester = require('babel-plugin-tester');

// For correct .babelrc detection inside the fixture directory we need to force babel's cwd and root to be the package root.
// This will ensure that the tests will run correctly from the mono repo root or package root.
const packageRootPath = path.resolve(__dirname, '..');

// @ts-expect-error pluginTester is not a function for some reason
pluginTester({
  plugin: () => {
    // return a dummy plugin here. We import and use the real plugin in the .babelrc.js files in the fixtures.
    return {
      name: 'dummy',
    };
  },
  babelOptions: {
    cwd: packageRootPath,
    root: packageRootPath,
  },
  fixtures: path.join(__dirname, 'fixtures'),
});
