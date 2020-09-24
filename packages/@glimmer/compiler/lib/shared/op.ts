import { HasSourceSpan, hasSpan, loc, MaybeHasSourceSpan, SourceSpan } from '@glimmer/syntax';

export type OpsTable<O extends Op> = {
  [P in O['name']]: O extends { name: P } ? O : never;
};

export type UnknownArgs = object | void;

export abstract class Op<Args extends UnknownArgs = UnknownArgs, Name extends string = string> {
  abstract readonly name: Name;
  constructor(readonly loc: SourceSpan, readonly args: Args) {}
}

export type OpName<O extends Op> = O['name'];
export type OpArgs<O extends Op> = O['args'];
export type InputOpArgs<O extends Op> = O['args'] extends void ? [] : [O['args']];

export function toArgs<O extends Op>(args: InputOpArgs<O>): OpArgs<O> {
  if (args.length === 0) {
    return undefined as OpArgs<O>;
  } else {
    return args[0] as OpArgs<O>;
  }
}

export type OpConstructor<O extends Op> = O extends Op<infer Args, infer Name>
  ? {
      new (loc: SourceSpan, args: Args): O & { name: Name };
    }
  : never;

export type OpForConstructor<C extends OpConstructor<Op>> = C extends OpConstructor<infer O>
  ? O
  : never;

function assertName<N extends string>(name: N, instance: object): N {
  if (name !== instance.constructor.name) {
    throw new Error(`unexpected ${name} did not match ${instance.constructor.name}`);
  } else {
    return name;
  }
}

export function op<N extends string>(
  name: N
): {
  args: <Args extends UnknownArgs>() => OpConstructor<Op<Args, N>>;
  void(): OpConstructor<Op<void, N>>;
} {
  return {
    args: <Args extends UnknownArgs>() =>
      class extends Op<Args, N> {
        readonly name: N = assertName(name, this);
      },

    void: () =>
      class extends Op<void, N> {
        readonly name: N = assertName(name, this);
      },
  };
}

export class UnlocatedOp<O extends Op> {
  constructor(private Class: OpConstructor<O>, private args: OpArgs<O>) {}

  maybeLoc(location: MaybeHasSourceSpan, fallback: HasSourceSpan): O {
    if (hasSpan(location)) {
      return this.loc(location);
    } else {
      return this.loc(fallback);
    }
  }

  loc(located: HasSourceSpan): O {
    return new this.Class(loc(located), this.args) as O;
  }
}
