export const LOCAL_DEBUG: true | false =
  import.meta.env.DEV &&
  (() => {
    let location = typeof window !== 'undefined' && window.location;
    if (location && /[&?]disable_local_debug/u.test(window.location.search)) {
      return false;
    }
    return true;
  })();

export const LOCAL_TRACE_LOGGING: true | false =
  import.meta.env.DEV &&
  (() => {
    let location = typeof window !== 'undefined' && window.location;
    if (location && /[&?]enable_trace_logging/u.test(window.location.search)) {
      return true;
    }
    return false;
  })();

export const LOCAL_EXPLAIN_LOGGING: true | false =
  import.meta.env.DEV &&
  (() => {
    let location = typeof window !== 'undefined' && window.location;
    if (location && /[&?]enable_trace_logging=explain/u.test(window.location.search)) {
      return true;
    }
    return false;
  })();
