import type { Dict, Nullable, Stack } from '@glimmer/interfaces';

import { unwrap } from './platform-utils';
import { getLast } from './present';

export function dict<T = unknown>(): Dict<T> {
  return Object.create(null);
}

export function isDict<T>(u: T): u is Dict & T {
  return u !== null && u !== undefined;
}

export function isObject<T>(u: T): u is object & T {
  return typeof u === 'function' || (typeof u === 'object' && u !== null);
}

export class StackImpl<T> implements Stack<T> {
  private stack: T[];
  public current: Nullable<T> = null;

  constructor(values: T[] = []) {
    this.stack = values;
  }

  public get size() {
    return this.stack.length;
  }

  push(item: T) {
    this.current = item;
    this.stack.push(item);
  }

  pop(): Nullable<T> {
    let item = this.stack.pop();
    let len = this.stack.length;
    this.current = len === 0 ? null : this.stack[len - 1];

    return item === undefined ? null : item;
  }

  nth(from: number): Nullable<T> {
    let len = this.stack.length;
    return len < from ? null : this.stack[len - from];
  }

  isEmpty(): boolean {
    return this.stack.length === 0;
  }

  toArray(): T[] {
    return this.stack;
  }
}
