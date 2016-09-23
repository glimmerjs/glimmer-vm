var findLib = require('./find-lib');
var rollup = require('./rollup');
var fs = require('fs');

var name = 'handlebars';
var entry = name + '/compiler/base.js';
var dir = findLib(name);

var HANDLEBARS_UTIL = /handlebars\/utils.js$/;

module.exports = rollup(dir, name, entry, {
  plugins: [{
    load: function (id) {
      if (HANDLEBARS_UTIL.test(id)) {
        var code = fs.readFileSync(id, 'utf8');
        return {
          code: code.replace(/export var isFunction/, 'export { isFunction }'),
          map: { mappings: null }
        };
      }
    }
  }]
});
