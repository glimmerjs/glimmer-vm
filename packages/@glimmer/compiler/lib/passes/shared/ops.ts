import { SourceLocation, SourcePosition } from '@glimmer/syntax';
import { positionToOffset, SourceOffsets } from './location';
import { InputOpArgs, Op, OpConstructor, toArgs, UnlocatedOp } from './op';

export type ArgsMap<K extends string | number> = {
  [P in K]: unknown;
};

export type Ops<O extends Op> = O | O[];

export class OpFactory<SubOp extends Op> {
  constructor(private source: string) {}

  op<O extends SubOp>(Class: OpConstructor<O>, ...args: InputOpArgs<O>): UnlocatedOp<O> {
    return new UnlocatedOp(Class, toArgs(args), this.source);
  }

  ops<O extends Op>(...ops: Ops<O>[]): O[] {
    let out: O[] = [];

    for (let op of ops) {
      if (Array.isArray(op)) {
        out.push(...op);
      } else {
        out.push(op);
      }
    }

    return out;
  }

  map<T, O extends Op>(input: T[], callback: (input: T) => O[]): O[] {
    let out: O[] = [];

    for (let v of input) {
      out.push(...callback(v));
    }

    return out;
  }
}

export type LocatedWithOffsets = { offsets: SourceOffsets };
export type LocatedWithPositions = { loc: SourceLocation };

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
    return { start, end };
  }
}

export type ArrayUnion<K extends string | number, Map extends ArgsMap<K>, Name extends K = K> = {
  [P in K]: [P, Map[P]];
}[Name];
