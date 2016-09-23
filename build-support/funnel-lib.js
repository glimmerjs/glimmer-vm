var funnel = require('broccoli-funnel');
var findLib = require('./find-lib');

module.exports = function funnelLib(name) {
  var libPath, options;
  if (arguments.length > 2) {
    libPath = arguments[1];
    options = arguments[2];
  } else {
    libPath = '.';
    options = arguments[1];
  }
  return funnel(findLib(name, libPath), options);
}
