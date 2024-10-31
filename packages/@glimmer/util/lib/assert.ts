// import Logger from './logger';

import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';

import { LOCAL_LOGGER } from '../index';

export default function assert(test: unknown, msg: string): asserts test {
  if (LOCAL_DEBUG) {
    if (!test) {
      throw new Error(msg || 'assertion failure');
    }
  }
}

export function deprecate(desc: string) {
  if (LOCAL_DEBUG) {
    LOCAL_LOGGER.warn(`DEPRECATION: ${desc}`);
  }
}
