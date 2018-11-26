import { Opaque, Dict } from '@glimmer/interfaces';
import { PathReference, Tag, Reference, CURRENT_TAG } from '@glimmer/reference';
import { CapturedArguments, Arguments } from '@glimmer/runtime';

export type UserHelper = (args: ReadonlyArray<Opaque>, named: Dict<Opaque>) => Opaque;

export class HelperReference implements PathReference<unknown> {
  private helper: UserHelper;
  private args: CapturedArguments;
  public tag: Tag = CURRENT_TAG;

  constructor(helper: UserHelper, args: Arguments) {
    this.helper = helper;
    this.args = args.capture();
  }

  value() {
    let { helper, args } = this;

    return helper(args.positional.value(), args.named.value());
  }

  get(prop: string): SimplePathReference {
    return new SimplePathReference(this, prop);
  }
}

export class SimplePathReference implements PathReference<unknown> {
  private parent: Reference<unknown>;
  private property: string;
  public tag: Tag = CURRENT_TAG;

  constructor(parent: Reference<unknown>, property: string) {
    this.parent = parent;
    this.property = property;
  }

  value(): unknown {
    let parent = this.parent.value();

    if (parent === null || parent === undefined) {
      return undefined;
    } else {
      return get(parent, this.property);
    }
  }

  get(prop: string): PathReference<unknown> {
    return new SimplePathReference(this, prop);
  }
}

function get(parent: unknown, key: string): unknown {
  if (parent === null || parent === undefined) {
    return undefined;
  } else {
    return (parent as Dict)[key];
  }
}
