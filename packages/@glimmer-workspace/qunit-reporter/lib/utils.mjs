/**
 * Converts an error into a simple string for comparisons.
 *
 * @param {Error|any} error
 * @return {string}
 */
export function errorString(error) {
  // Use String() instead of toString() to handle non-object values like undefined or null.
  const resultErrorString = String(error);

  // If the error wasn't a subclass of Error but something like
  // an object literal with name and message properties...
  if (resultErrorString.slice(0, 7) === '[object') {
    // Based on https://es5.github.io/#x15.11.4.4
    return (error.name || 'Error') + (error.message ? `: ${error.message}` : '');
  } else {
    return resultErrorString;
  }
}

/**
 * @param {string | undefined} str
 * @return {string}
 */
export function escapeText(str) {
  if (!str) {
    return '';
  }

  // Both single quotes and double quotes (for attributes)
  return str.replace(/["&'<>]/gu, (s) => {
    switch (s) {
      case "'":
        return '&#039;';
      case '"':
        return '&quot;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
    }
  });
}

// eslint-disable-next-line @typescript-eslint/unbound-method
const hasOwn = Object.prototype.hasOwnProperty;

/**
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 * @param {boolean} [undefOnly]
 */
export function extend(a, b, undefOnly) {
  for (const prop in b) {
    if (hasOwn.call(b, prop)) {
      if (b[prop] === undefined) {
        delete a[prop];
      } else if (!(undefOnly && typeof a[prop] !== 'undefined')) {
        a[prop] = b[prop];
      }
    }
  }

  return a;
}
