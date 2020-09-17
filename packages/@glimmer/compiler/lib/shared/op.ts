import {
  MaybeHasOffsets,
  MaybeHasSourceLocation,
  SourceOffsets,
  Source,
  HasSourceLocation,
} from '@glimmer/syntax';

export type OpsTable<O extends Op> = {
  [P in O['name']]: O extends { name: P } ? O : never;
};

export type UnknownArgs = object | void;

export abstract class Op<Args extends UnknownArgs = UnknownArgs, Name extends string = string> {
  abstract readonly name: Name;
  constructor(readonly offsets: SourceOffsets, readonly args: Args) {}

  // TODO abstract stack = [{ value: EXPR }]
  // this would automate the process of extracting values off of the stack
  // and checking them for the right types
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
      new (offsets: SourceOffsets, args: Args): O & { name: Name };
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
  private source: Source;

  constructor(private Class: OpConstructor<O>, private args: OpArgs<O>, source: Source) {
    this.source = source;
  }

  maybeLoc(location: MaybeHasSourceLocation, fallback?: HasSourceLocation): O {
    let offsets = this.source.maybeOffsetsFor(location, fallback);
    return this.withOffsets(offsets);
  }

  loc(location: HasSourceLocation): O {
    let offsets = this.source.offsetsFor(location);
    return this.withOffsets(offsets);
  }

  withOffsets(offsets: SourceOffsets): O {
    return new this.Class(offsets, this.args) as O;
  }

  offsets(location: MaybeHasOffsets): O {
    let offsets: SourceOffsets | null;

    if (location === null || 'start' in location) {
      offsets = location;
    } else if ('offsets' in location) {
      offsets = location.offsets;
    } else {
      let start = location[0];
      let end = location[location.length - 1];

      if (start.offsets === null || end.offsets === null) {
        offsets = null;
      } else {
        let startOffset = start.offsets.start;
        let endOffset = end.offsets.end;

        offsets = new SourceOffsets(this.source, startOffset, endOffset);
      }
    }

    return this.withOffsets(offsets || this.source.NONE);
  }
}
