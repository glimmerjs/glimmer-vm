var get = require('babel-helpers').default;
var generate = require('babel-generator').default;
var t = require('babel-types');

var HELPERS = [
  'taggedTemplateLiteralLoose',
  'possibleConstructorReturn',
  'inherits',
  'createClass',
  'classCallCheck',
  'taggedTemplateLiteralLoose'
].map(function (name) {
  var ast = get(name);
  ast.id = t.identifier(name)
  return {
    name: name,
    code: generate(ast).code
  }
});

module.exports = function helpers(format) {
  var code = HELPERS.map(function (helper) {
    if (format === 'es') {
      return 'export ' + helper.code;
    }
    return 'exports.' + helper.name + " = " + helper.code;
  }).join('\n');
  if (format === 'amd') {
    code = 'define(\'babel-helpers\', [\'exports\'], function (exports) {\n' + code + '\n});\n';
  }
  return code;
}
