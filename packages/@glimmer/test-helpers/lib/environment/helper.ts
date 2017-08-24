
import { Dict, Opaque } from '@glimmer/interfaces';
import { PathReference, Reference, Tag, VOLATILE_TAG } from '@glimmer/reference';
import { Arguments, CapturedArguments } from '@glimmer/runtime';

export type UserHelper = (args: ReadonlyArray<Opaque>, named: Dict<Opaque>) => Opaque;

export class HelperReference implements PathReference<Opaque> {
  private helper: UserHelper;
  private args: CapturedArguments;
  tag: Tag = VOLATILE_TAG;

  constructor(helper: UserHelper, args: Arguments) {
    this.helper = helper;
    this.args = args.capture();
  }

  value() {
    let { helper, args } = this;

    return helper(args.positional.value(), args.named.value());
  }

  get(prop: string): SimplePathReference<Opaque> {
    return new SimplePathReference(this, prop);
  }
}

export class SimplePathReference<T> implements PathReference<T> {
  private parent: Reference<T>;
  private property: string;
  tag: Tag = VOLATILE_TAG;

  constructor(parent: Reference<T>, property: string) {
    this.parent = parent;
    this.property = property;
  }

  value(): T {
    return this.parent.value()[this.property];
  }

  get(prop: string): PathReference<Opaque> {
    return new SimplePathReference(this, prop);
  }
}
