var keys = Object.keys;

module.exports = function assign(obj) {
  for (var i = 1; i < arguments.length; i++) {
    var src = arguments[i];
    if (src === undefined || src === null || typeof src !== 'object') continue;
    var keys = Object.keys(src);
    for (var j = 0; j < keys.length; j++) {
      var key = keys[j];
      obj[key] = src[key];
    }
  }
  return obj;
}
