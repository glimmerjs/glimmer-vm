import { getPath, toIterator } from '@glimmer/global-context';
import type { Dict, Nullable, Optional } from '@glimmer/interfaces';
import { EMPTY_ARRAY, isObject } from '@glimmer/util';
import { consumeTag, createTag, dirtyTag } from '@glimmer/validator';

import {
  createComputeRef,
  type Reference,
  type ReferenceEnvironment,
  valueForRef,
} from './reference';

export interface IterationItem<T, U> {
  key: unknown;
  value: T;
  memo: U;
}

export interface AbstractIterator<T, U, V extends IterationItem<T, U>> {
  _isEmpty_(): boolean;
  _next_(): Nullable<V>;
}

export type OpaqueIterationItem = IterationItem<unknown, unknown>;
export type OpaqueIterator = AbstractIterator<unknown, unknown, OpaqueIterationItem>;

export interface IteratorDelegate {
  isEmpty(): boolean;
  next(): { value: unknown; memo: unknown } | null;
}

export interface IteratorReferenceEnvironment extends ReferenceEnvironment {
  getPath(obj: unknown, path: string): unknown;
  toIterator(obj: unknown): Nullable<IteratorDelegate>;
}

type KeyFor = (item: unknown, index: unknown) => unknown;

const NULL_IDENTITY = {};

const KEY: KeyFor = (_, index) => index;
const INDEX: KeyFor = (_, index) => String(index);
const IDENTITY: KeyFor = (item) => {
  if (item === null) {
    // Returning null as an identity will cause failures since the iterator
    // can't tell that it's actually supposed to be null
    return NULL_IDENTITY;
  }

  return item;
};

function keyForPath(path: string): KeyFor {
  if (import.meta.env.DEV && path[0] === '@') {
    throw new Error(`invalid keypath: '${path}', valid keys: @index, @identity, or a path`);
  }
  return uniqueKeyFor((item) => getPath(item as object, path));
}

function makeKeyFor(key: string) {
  switch (key) {
    case '@key':
      return uniqueKeyFor(KEY);
    case '@index':
      return uniqueKeyFor(INDEX);
    case '@identity':
      return uniqueKeyFor(IDENTITY);
    default:
      return keyForPath(key);
  }
}

class WeakMapWithPrimitives<T> {
  #lazyWeakMap?: WeakMap<object, T>;
  #lazyPrimitiveMap?: Map<unknown, T>;

  get #weakMap() {
    return (this.#lazyWeakMap ??= new WeakMap());
  }

  get #primitiveMap() {
    return (this.#lazyPrimitiveMap ??= new Map());
  }

  _set_(key: unknown, value: T) {
    if (isObject(key)) {
      this.#weakMap.set(key, value);
    } else {
      this.#primitiveMap.set(key, value);
    }
  }

  _get_(key: unknown): T | undefined {
    return isObject(key) ? this.#weakMap.get(key) : this.#primitiveMap.get(key);
  }
}

const IDENTITIES = new WeakMapWithPrimitives<object[]>();

function identityForNthOccurence(value: unknown, count: number): object {
  let identities = IDENTITIES._get_(value);

  if (!identities) {
    identities = [];
    IDENTITIES._set_(value, identities);
  }

  let identity: Optional<object> = identities[count];

  if (!identity) {
    identity = import.meta.env.DEV ? { value, count } : {};
    identities[count] = identity;
  }

  return identity;
}

/**
 * When iterating over a list, it's possible that an item with the same unique
 * key could be encountered twice:
 *
 * ```js
 * let arr = ['same', 'different', 'same', 'same'];
 * ```
 *
 * In general, we want to treat these items as _unique within the list_. To do
 * this, we track the occurences of every item as we iterate the list, and when
 * an item occurs more than once, we generate a new unique key just for that
 * item, and that occurence within the list. The next time we iterate the list,
 * and encounter an item for the nth time, we can get the _same_ key, and let
 * Glimmer know that it should reuse the DOM for the previous nth occurence.
 */
function uniqueKeyFor(keyFor: KeyFor): (value: unknown, memo: unknown) => unknown {
  let seen = new WeakMapWithPrimitives<number>();

  return (value: unknown, memo: unknown): unknown => {
    let key = keyFor(value, memo);
    let count = seen._get_(key) || 0;

    seen._set_(key, count + 1);

    if (count === 0) {
      return key;
    }

    return identityForNthOccurence(key, count);
  };
}

export function createIteratorRef(listRef: Reference, key: string) {
  return createComputeRef(() => {
    let iterable = valueForRef(listRef) as { [Symbol.iterator]: any } | null | false;

    let keyFor = makeKeyFor(key);

    if (Array.isArray(iterable)) {
      return new ArrayIterator(iterable, keyFor);
    }

    let maybeIterator = toIterator(iterable);

    if (maybeIterator === null) {
      return new ArrayIterator(EMPTY_ARRAY, () => null);
    }

    return new IteratorWrapper(maybeIterator, keyFor);
  });
}

export function createIteratorItemRef(_value: unknown) {
  let value = _value;
  let tag = createTag();

  return createComputeRef(
    () => {
      consumeTag(tag);
      return value;
    },
    (newValue) => {
      if (value !== newValue) {
        value = newValue;
        dirtyTag(tag);
      }
    }
  );
}

class IteratorWrapper implements OpaqueIterator {
  readonly #inner: IteratorDelegate;
  readonly #keyFor: KeyFor;

  constructor(inner: IteratorDelegate, keyFor: KeyFor) {
    this.#inner = inner;
    this.#keyFor = keyFor;
  }

  _isEmpty_() {
    return this.#inner.isEmpty();
  }

  _next_() {
    let nextValue = this.#inner.next() as OpaqueIterationItem;

    if (nextValue !== null) {
      nextValue.key = this.#keyFor(nextValue.value, nextValue.memo);
    }

    return nextValue;
  }
}

const EMPTY = ['empty'] as const;
const PROGRESS = ['progress'] as const;

class ArrayIterator implements OpaqueIterator {
  readonly #iterator: unknown[] | readonly unknown[];
  readonly #keyFor: KeyFor;
  #current: readonly ['empty'] | readonly ['progress'] | readonly [kind: 'first', value: unknown];
  #pos = 0;

  constructor(iterator: unknown[] | readonly unknown[], keyFor: KeyFor) {
    this.#iterator = iterator;
    this.#keyFor = keyFor;
    if (iterator.length === 0) {
      this.#current = EMPTY;
    } else {
      this.#current = ['first', iterator[this.#pos]];
    }
  }

  _isEmpty_(): boolean {
    return this.#current === EMPTY;
  }

  _next_(): Nullable<IterationItem<unknown, number>> {
    let value: unknown;

    let current = this.#current;
    if (current[0] === 'first') {
      this.#current = PROGRESS;
      value = current[1];
    } else if (this.#pos >= this.#iterator.length - 1) {
      return null;
    } else {
      value = this.#iterator[++this.#pos];
    }

    let key = this.#keyFor(value as Dict, this.#pos);
    let memo = this.#pos;

    return { key, value, memo };
  }
}
