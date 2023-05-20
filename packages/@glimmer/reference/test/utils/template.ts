import type { IteratorDelegate } from '@glimmer/reference';

import objectValues from './platform';

abstract class BoundedIterator implements IteratorDelegate {
  #position = 0;
  readonly #length: number;

  constructor(length: number) {
    this.#length = length;
  }

  isEmpty(): false {
    return false;
  }

  abstract valueFor(position: number): unknown;

  memoFor(position: number): unknown {
    return position;
  }

  next() {
    let position = this.#position;

    if (position >= this.#length) {
      return null;
    }

    let value = this.valueFor(position);
    let memo = this.memoFor(position);

    this.#position++;

    return { value, memo };
  }
}

interface Indexable {
  readonly [key: string]: unknown;
}

class ObjectIterator extends BoundedIterator {
  static fromIndexable(obj: Indexable) {
    let keys = Object.keys(obj);
    let values = objectValues(obj);

    return new this(keys, values);
  }

  readonly #keys: unknown[];
  readonly #values: unknown[];

  constructor(keys: unknown[], values: unknown[]) {
    super(values.length);
    this.#keys = keys;
    this.#values = values;
  }

  valueFor(position: number): unknown {
    return this.#values[position];
  }

  override memoFor(position: number): unknown {
    return this.#keys[position];
  }
}

export const TestContext = {
  getProp(obj: unknown, path: string) {
    return (obj as any)[path];
  },

  getPath(obj: unknown, path: string) {
    return (obj as any)[path];
  },

  setProp(obj: unknown, path: string, value: unknown) {
    return ((obj as any)[path] = value);
  },

  toIterator(obj: unknown) {
    if (typeof obj === 'object' && obj !== null) {
      return ObjectIterator.fromIndexable(obj as Indexable);
    }

    return null;
  },
};
