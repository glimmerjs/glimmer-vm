import { CONSTANT_TAG, Tag, VersionedReference } from './validators';

export class ConstReference<T> implements VersionedReference<T> {
  tag: Tag = CONSTANT_TAG;

  constructor(protected inner: T) { }

  value(): T { return this.inner; }
}
