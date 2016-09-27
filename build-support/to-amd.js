var Babel = require('broccoli-babel-transpiler');
var funnel = require('broccoli-funnel');
var moduleResolve = require('amd-name-resolver').moduleResolve;

module.exports = function toAMD(tree) {
  var babel = new Babel(tree, {
    moduleIds: true,
    resolveModuleSource: moduleResolve,
    sourceMap: 'inline',
    plugins: [ 'transform-es2015-modules-amd' ]
  });
  return funnel(babel, {
    destDir: 'named-amd',
    annotation: 'to named-amd'
  });
}
