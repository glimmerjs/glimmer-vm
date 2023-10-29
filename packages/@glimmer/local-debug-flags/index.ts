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
