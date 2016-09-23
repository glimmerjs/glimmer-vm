var path = require('path');

module.exports = function findLib(name, libPath) {
  return path.resolve(path.dirname(require.resolve(name)), libPath || '.');
}
