import type { Dict, Nullable, PresentArray, PresentStack, Stack } from '@glimmer/interfaces';

import { unwrap } from './platform-utils';
import { assert } from './assert';

export function dict<T = unknown>(): Dict<T> {
  return Object.create(null);
}

export function isDict<T>(u: T): u is Dict & T {
  return u !== null && u !== undefined;
}

export function isObject<T>(u: T): u is object & T {
  return typeof u === 'function' || (typeof u === 'object' && u !== null);
}

export class PresentStackImpl<T> implements PresentStack<T> {
  static initial<T>(value: T): PresentStack<T> {
    return new PresentStackImpl([value]);
  }

  readonly #stack: PresentArray<T>;

  constructor(stack: PresentArray<T>) {
    this.#stack = stack;
  }

  replace(value: T): void {
    this.#stack.splice(-1, 1, value);
    assert(this.#stack.length > 0, `BUG: PresentStack must not be empty.`);
  }

  get current() {
    assert(this.#stack.length > 0, `BUG: PresentStack must not be empty.`);

    return this.#stack.at(-1) as T;
  }

  get size() {
    return this.#stack.length;
  }

  push(...items: T[]): void {
    this.#stack.push(...items);
  }

  pop(): T {
    assert(this.#stack.length > 1, `BUG: Popping the last element from a PresentStack.`);
    return unwrap(this.#stack.pop());
  }

  nth(from: number): T {
    assert(
      this.#stack.length > from,
      `Stack Index out of bounds (stack is ${this.#stack.length} long, index is ${from})`
    );
    return this.#stack.at(from)!;
  }

  isEmpty(): false {
    return false;
  }

  toArray(): PresentArray<T> {
    return this.#stack;
  }
}

export class StackImpl<T> implements Stack<T> {
  readonly #stack: T[];

  constructor(values: T[] = []) {
    this.#stack = values;
  }

  get size() {
    return this.#stack.length;
  }

  get current(): Nullable<T> {
    return this.#stack.at(-1) ?? null;
  }

  push(item: T) {
    this.#stack.push(item);
  }

  pop(): Nullable<T> {
    let item = this.#stack.pop();

    return item === undefined ? null : item;
  }

  nth(from: number): Nullable<T> {
    let length = this.#stack.length;
    return length < from ? null : unwrap(this.#stack[length - from]);
  }

  isEmpty(): boolean {
    return this.#stack.length === 0;
  }

  toArray(): T[] {
    return this.#stack;
  }
}
