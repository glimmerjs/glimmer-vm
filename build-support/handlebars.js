var funnelLib = require('./funnel-lib');
var toES5 = require('./to-es5');
var rollup = require('./rollup');
var fs = require('fs');

var HANDLEBARS_UTIL = /\/utils.js$/;

module.exports = rollup(
  toES5(funnelLib('handlebars', './handlebars', {
    include: ['**/*.js']
  })
), 'handlebars', 'compiler/base.js', {
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
