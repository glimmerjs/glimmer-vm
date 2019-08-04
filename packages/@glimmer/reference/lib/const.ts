import { CONSTANT_TAG, Tag } from './validators';
import { VersionedReference } from './reference';

export class ConstReference<T> implements VersionedReference<T> {
  public tag: Tag = CONSTANT_TAG;

  constructor(protected inner: T) {}

  value(): T {
    return this.inner;
  }
}
