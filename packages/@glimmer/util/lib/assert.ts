// import Logger from './logger';

import type { Maybe } from '@glimmer/interfaces';

import { LOCAL_LOGGER } from './index';

// let alreadyWarned = false;

export function unwrap<T>(value: Maybe<T>): T {
  assert(value !== null && value !== undefined, 'value is null or undefined');
  return value;
}

export function assert(condition: unknown, msg: string): asserts condition {
  if (import.meta.env.DEV) {
    if (!condition) {
      throw new Error(msg || 'assertion failure');
    }
  }
}

export function deprecate(desc: string) {
  LOCAL_LOGGER.warn(`DEPRECATION: ${desc}`);
}

export default assert;
