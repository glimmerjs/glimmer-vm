var Rollup = require('broccoli-rollup');
var path = require('path');
var assign = require('./assign');

module.exports = function rollup(tree, name, entry, options) {
  var annotation;
  if (options && options.annotation) {
    delete options.annotation;
  } else {
    annotation = name;
  }
  return new Rollup(tree, {
    rollup: assign({
      entry: entry,
      targets: [{
        format: 'cjs',
        dest: 'node_modules/' + name + '/index.js'
      }, {
        format: 'amd',
        moduleId: name,
        dest: 'named-amd/' + name + '.js'
      }, {
        format: 'es',
        dest: 'es6/' + name + '.js'
      }]
    }, options),
    annotation: annotation
  });
};
