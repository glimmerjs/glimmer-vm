var Babel = require('broccoli-babel-transpiler');
var assign = require('./assign');

module.exports = function toES5(tree, _options) {
  var options = assign({}, _options);
  options.plugins = [
    function () {
      return {
        pre: function (file) {
          file.set('helperGenerator', function (name) {
            return file.addImport('babel-helpers', name, name);
          });
        }
      };
    },
    ['transform-es2015-template-literals', {loose: true}],
    ['transform-es2015-arrow-functions'],
    ['transform-es2015-destructuring', {loose: true}],
    ['transform-es2015-spread', {loose: true}],
    ['transform-es2015-parameters'],
    ['transform-es2015-computed-properties', {loose: true}],
    ['transform-es2015-shorthand-properties'],
    ['transform-es2015-block-scoping'],
    ['check-es2015-constants'],
    ['transform-es2015-classes', {loose: true}],
    ['transform-proto-to-assign']
  ];
  var babel = new Babel(tree, options);
  // needed until new version published for helpers plugin
  babel.cacheKey = function () {
    var key = Babel.prototype.cacheKey.apply(this, arguments);
    return key + "babel-helpers-version101";
  };
  return babel;
}
