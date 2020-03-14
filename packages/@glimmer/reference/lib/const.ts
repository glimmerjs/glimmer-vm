import { CONSTANT_TAG, Tag } from '@glimmer/validator';
import { PathReference } from './reference';
import { UNDEFINED_REFERENCE } from './primitive';

export class ConstReference<T = unknown> implements PathReference<T> {
  public tag: Tag = CONSTANT_TAG;

  constructor(protected inner: T) {}

  value(): T {
    return this.inner;
  }

  get(_key: string): PathReference {
    return UNDEFINED_REFERENCE;
  }
}
