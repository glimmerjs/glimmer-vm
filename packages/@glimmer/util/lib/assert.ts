// import Logger from './logger';

import { LOCAL_LOGGER } from '../index';

// let alreadyWarned = false;

export function assert(test: any, msg: string): asserts test {
  // if (!alreadyWarned) {
  //   alreadyWarned = true;
  //   Logger.warn("Don't leave debug assertions on in public builds");
  // }

  if (import.meta.env.DEV) {
    if (!test) {
      throw new Error(msg || 'assertion failure');
    }
  }
}

export function deprecate(desc: string) {
  if (import.meta.env.DEV) {
    LOCAL_LOGGER.warn(`DEPRECATION: ${desc}`);
  }
}
