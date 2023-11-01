export const LOCAL_DEBUG = import.meta.env.DEV && !hasFlag('disable_local_debug');
export const LOCAL_TRACE_LOGGING = hasFlag('enable_trace_logging');
export const LOCAL_EXPLAIN_LOGGING = hasFlag('enable_trace_explanations');
export const LOCAL_INTERNALS_LOGGING = hasFlag('enable_internals_logging');
export const LOCAL_SUBTLE_LOGGING = hasFlag('enable_subtle_logging');

// This function should turn into a constant `return false` in `import.meta.env.PROD`,
// which should inline properly via terser, swc and esbuild.
//
// https://tiny.katz.zone/BNqN3F
function hasFlag(flag: string): true | false {
  if (import.meta.env.DEV) {
    let location = typeof window !== 'undefined' && window.location;
    const pattern = new RegExp(`[&?]${flag}(?:&|$|%)`, 'u');

    return !!(location && pattern.test(window.location.search));
  } else {
    return false;
  }
}

/**
 * If the specified flag is set as a boolean flag with no value, `true` is returned.
 *
 * Otherwise, this function returns true if the flag value is a pattern that matches `value`.
 *
 * The pattern can have a `*`, which matches any number of characters.
 */
export function hasFlagWith(flag: string, value: string): boolean {
  if (import.meta.env.DEV) {
    let location = typeof window !== 'undefined' && window.location;
    const pattern = new RegExp(`[&?]${flag}(?:=(.*?))?(?:&|$|%)?(?:&|$|%)`, 'u');

    const match = location && pattern.exec(window.location.search);

    const capture = match && match[1];

    if (match && !capture) {
      return true;
    } else if (capture) {
      // convert the capture into a pattern (where `*` is replaced with `.*`)
      const capturePattern = new RegExp(`^${capture.replace(/\*/g, '.*')}$`, 'u');
      return !!capturePattern.test(value);
    } else {
      return false;
    }
  } else {
    return false;
  }
}
