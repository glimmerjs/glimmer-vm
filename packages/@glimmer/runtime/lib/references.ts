import { Opaque } from '@glimmer/interfaces';
import { Reference, Tag } from '@glimmer/reference';

export class ConditionalReference implements Reference<boolean> {
  public tag: Tag;

  constructor(private inner: Reference<Opaque>) {
    this.tag = inner.tag;
  }

  value(): boolean {
    return this.toBool(this.inner.value());
  }

  protected toBool(value: Opaque): boolean {
    return !!value;
  }
}
