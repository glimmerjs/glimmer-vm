export const LOCAL_DEBUG: true | false = import.meta.env.DEV
  ? (() => {
      let location = typeof window !== 'undefined' && window.location;
      if (location && /[&?]disable_local_debug/u.test(window.location.search)) {
        return false;
      }
      return true;
    })()
  : false;

export const LOCAL_SHOULD_LOG: true | false = import.meta.env.DEV
  ? (() => {
      let location = typeof window !== 'undefined' && window.location;
      if (location && /[&?]local-should-log/u.test(window.location.search)) {
        return true;
      }
      return false;
    })()
  : false;
