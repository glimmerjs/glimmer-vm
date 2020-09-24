import { PresentArray } from '@glimmer/interfaces';

import { InputOpArgs, Op, OpConstructor, toArgs, UnlocatedOp } from './op';

export type ArgsMap<K extends string | number> = {
  [P in K]: unknown;
};

export type Ops<O extends Op> = O | O[];

export class OpFactory<SubOp extends Op> {
  op<O extends SubOp>(Class: OpConstructor<O>, ...args: InputOpArgs<O>): UnlocatedOp<O> {
    return new UnlocatedOp(Class, toArgs(args));
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

  map<T, O extends Op>(input: PresentArray<T>, callback: (input: T) => O): PresentArray<O>;
  map<T, O extends Op>(input: T[], callback: (input: T) => O): O[];
  map<T, O extends Op>(input: T[], callback: (input: T) => O): O[] {
    let out: O[] = [];

    for (let v of input) {
      out.push(callback(v));
    }

    return out;
  }

  flatMap<T, O extends Op>(
    input: PresentArray<T>,
    callback: (input: T) => PresentArray<O>
  ): PresentArray<O>;
  flatMap<T, O extends Op>(input: T[], callback: (input: T) => O[]): O[];
  flatMap<T, O extends Op>(input: T[], callback: (input: T) => O[]): O[] {
    let out: O[] = [];

    for (let v of input) {
      out.push(...callback(v));
    }

    return out;
  }
}

export type ArrayUnion<K extends string | number, Map extends ArgsMap<K>, Name extends K = K> = {
  [P in K]: [P, Map[P]];
}[Name];
