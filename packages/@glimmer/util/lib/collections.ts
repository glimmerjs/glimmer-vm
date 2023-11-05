import type { Dict } from '@glimmer/interfaces';

export function dict<T = unknown>(): Dict<T> {
  return Object.create(null);
}

export function isDict<T>(u: T): u is Dict & T {
  return u !== null && u !== undefined;
}

export function isObject<T>(u: T): u is object & T {
  return typeof u === 'function' || (typeof u === 'object' && u !== null);
}
