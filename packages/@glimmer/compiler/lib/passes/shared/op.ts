import { PresentArray } from '@glimmer/interfaces';
import { SourceLocation, SourcePosition } from '@glimmer/syntax';
import { isPresent } from '@glimmer/util';
import { locationToOffsets, MaybeHasOffsets, positionToOffset, SourceOffsets } from './location';
import { LocatedWithOptionalPositions, LocatedWithPositions } from './ops';

export type OpsTable<O extends Op> = {
  [P in O['name']]: O extends { name: P } ? O : never;
};

export type UnknownArgs = object | void;

export abstract class Op<Args extends UnknownArgs = UnknownArgs, Name extends string = string> {
  abstract readonly name: Name;
  constructor(readonly offsets: SourceOffsets | null, readonly args: Args) {}

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
      new (offsets: SourceOffsets | null, args: Args): O & { name: Name };
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

export function range(
  first: SourcePosition,
  last: SourcePosition,
  source: string
): SourceOffsets | null {
  let start = positionToOffset(source, { line: first.line, column: first.column });
  let end = positionToOffset(source, { line: last.line, column: last.column });

  if (start === null || end === null) {
    return null;
  } else {
    return new SourceOffsets(start, end);
  }
}

function isLocatedWithPositionsArray(
  location: LocatedWithOptionalPositions[]
): location is PresentArray<LocatedWithPositions> {
  return isPresent(location) && location.every(isLocatedWithPositions);
}

function isLocatedWithPositions(
  location: LocatedWithOptionalPositions
): location is LocatedWithPositions {
  return location.loc !== undefined;
}

export type HasSourceLocation =
  | SourceLocation
  | LocatedWithPositions
  | PresentArray<LocatedWithPositions>;

export type MaybeHasSourceLocation =
  | null
  | LocatedWithOptionalPositions
  | LocatedWithOptionalPositions[];

export class Source {
  constructor(readonly source: string) {}

  maybeLoc(location: MaybeHasSourceLocation, fallback?: HasSourceLocation): SourceOffsets | null {
    if (location === null) {
      return fallback ? this.loc(fallback) : null;
    } else if (Array.isArray(location)) {
      if (isLocatedWithPositionsArray(location)) {
        return this.loc(location);
      } else {
        return null;
      }
    } else if (isLocatedWithPositions(location)) {
      return this.loc(location);
    } else {
      return null;
    }
  }

  loc(location: HasSourceLocation): SourceOffsets | null {
    if (Array.isArray(location)) {
      let first = location[0];
      let last = location[location.length - 1];

      return range(first.loc.start, last.loc.end, this.source);
    } else if ('loc' in location) {
      let { loc } = location;
      return range(loc.start, loc.end, this.source);
    } else {
      return locationToOffsets(this.source, location);
    }
  }
}

export class UnlocatedOp<O extends Op> {
  private source: Source;

  constructor(private Class: OpConstructor<O>, private args: OpArgs<O>, source: string) {
    this.source = new Source(source);
  }

  maybeLoc(location: MaybeHasSourceLocation, fallback?: HasSourceLocation): O {
    let offsets = this.source.maybeLoc(location, fallback);
    return this.withOffsets(offsets);
  }

  loc(location: HasSourceLocation): O {
    let offsets = this.source.loc(location);
    return this.withOffsets(offsets);
  }

  withOffsets(offsets: SourceOffsets | null): O {
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

        offsets = new SourceOffsets(startOffset, endOffset);
      }
    }

    return this.withOffsets(offsets);
  }
}
