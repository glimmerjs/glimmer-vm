// import Logger from './logger';

import { LOCAL_LOGGER } from '../index';

// let alreadyWarned = false;

export function assert(test: any, message: string): asserts test {
  // if (!alreadyWarned) {
  //   alreadyWarned = true;
  //   Logger.warn("Don't leave debug assertions on in public builds");
  // }

  if (import.meta.env.DEV && !test) {
      throw new Error(message || 'assertion failure');
    }
}

export function deprecate(desc: string) {
  if (import.meta.env.DEV) {
    LOCAL_LOGGER.warn(`DEPRECATION: ${desc}`);
  }
}
