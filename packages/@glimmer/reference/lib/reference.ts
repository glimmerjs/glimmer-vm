import { symbol } from '@glimmer/util';
import { memoizeTracked } from '@glimmer/validator';

export interface Reference<T = unknown> {
  value(): T;
}

export default Reference;

export interface PathReference<T = unknown> extends Reference<T> {
  get(key: string): PathReference<unknown>;
}

//////////

export abstract class CachedReference<T> implements Reference<T> {
  value = memoizeTracked((): T => this.compute());

  protected abstract compute(): T;
}

//////////

export class ReferenceCache<T> {
  private reference: Reference<T>;
  private lastValue: T;

  constructor(reference: Reference<T>) {
    this.reference = reference;
    this.lastValue = reference.value();
  }

  revalidate(): Validation<T> {
    let { lastValue } = this;
    let currentValue = this.reference.value();

    if (currentValue === lastValue) return NOT_MODIFIED;
    this.lastValue = currentValue;

    return currentValue;
  }
}

export type Validation<T> = T | NotModified;

export type NotModified = typeof NOT_MODIFIED;

const NOT_MODIFIED: unique symbol = symbol('NOT_MODIFIED');

export function isModified<T>(value: Validation<T>): value is T {
  return value !== NOT_MODIFIED;
}
