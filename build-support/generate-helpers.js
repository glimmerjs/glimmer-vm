var get = require('babel-helpers').default;
var generate = require('babel-generator').default;
var t = require('babel-types');

var REGEX = /if \(superClass\) Object\.setPrototypeOf \?[^;]*;/
var REPLACE = 'if(superClass)if(Object.setPrototypeOf)Object.setPrototypeOf(subClass,superClass);else for(var p in superClass)superClass.hasOwnProperty(p)&&(subClass[p]=superClass[p]);'

var HELPERS = [
  'taggedTemplateLiteralLoose',
  'possibleConstructorReturn',
  'inherits',
  'createClass',
  'classCallCheck',
  'taggedTemplateLiteralLoose'
].map(function (name) {
  var ast = get(name);
  ast.id = t.identifier(name);
  var code = generate(ast).code;
  if (name === 'inherits') {
    // IE 9 and 10 fix
    code = code.replace(/if \(superClass\) Object\.setPrototypeOf \?[^;]*;/, REPLACE);
  }
  return {
    name: name,
    code: code
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
