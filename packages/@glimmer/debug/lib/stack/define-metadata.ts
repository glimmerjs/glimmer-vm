import type { Expand, VmOpName } from '@glimmer/interfaces';
import type { SpecName } from './declared/shared';
import type { OpSpec, OpcodeSpec, StackParamSpec, StackSpec, StateSpec } from './types';

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

interface MutableInitializeStack {
  params: StackParamSpec[];
  pushes: SpecName[] | 'frame:change';
}

type Spread<T, U> = {
  [P in keyof T]: P extends keyof U ? U[P] : T[P];
};

export class Define<O extends OpSpec> {
  static done<O extends OpSpec>(define: Define<O>): O {
    return define.#spec;
  }

  readonly #spec: O;

  constructor(spec: O) {
    this.#spec = spec;
  }

  ops<Opcodes extends OpcodeSpec>(...ops: Opcodes): Define<Spread<O, { ops: Opcodes }>> {
    (this.#spec as Mutable<O>).ops = ops;
    return this as any;
  }

  reads<const S extends readonly StateSpec[]>(
    ...reads: S
  ): Define<Spread<O, { readonly reads: S }>> {
    (this.#spec as Mutable<O>).reads = reads;
    return this as any;
  }

  changes<const S extends readonly StateSpec[]>(
    ...changes: S
  ): Define<Spread<O, { readonly changes: S }>> {
    (this.#spec as Mutable<O>).changes = changes;
    return this as any;
  }

  changesFrame(): Define<O> {
    this.#initializedStack().pushes = 'frame:change';
    return this as any;
  }

  #initializedStack(): MutableInitializeStack {
    if (!this.#spec.stack || typeof this.#spec.stack === 'string') {
      (this.#spec as Mutable<OpSpec>).stack = {
        params: [],
        pushes: [],
      } as const;
    }

    return this.#spec.stack as Mutable<{
      params: StackParamSpec[];
      pushes: SpecName[];
    }>;
  }

  unchanged(): Define<Spread<O, { stack: { params: []; pushes: [] } }>> {
    (this.#spec as Mutable<O>).stack = {
      params: [],
      pushes: [],
    };
    return this as any;
  }

  pushes<S extends SpecName[]>(
    ...pushes: S
  ): Define<
    Spread<
      O,
      {
        stack: {
          params: O['stack']['params'];
          pushes: S;
        };
      }
    >
  > {
    this.#initializedStack().pushes = pushes;
    return this as any;
  }

  pops<Name extends string, Param extends SpecName>(
    name: Name,
    param: Param
  ): Define<
    Spread<
      O,
      {
        stack: {
          params: [...O['stack']['params'], [`pop:${Name}`, Param]];
          pushes: O['stack']['pushes'];
        };
      }
    >
  > {
    this.#initializedStack().params.push([`pop:${name}`, param]);
    return this as any;
  }

  peeks<Name extends string, Param extends SpecName>(
    name: Name,
    param: Param
  ): Define<
    Spread<
      O,
      {
        stack: {
          params: [...StackSpec['params'], [`peek:${Name}`, Param]];
          pushes: O['stack']['pushes'];
        };
      }
    >
  >;
  peeks<Name extends string, Param extends SpecName>(
    name: Name,
    param: Param,
    options: { from: '$fp' }
  ): Define<
    Spread<
      O,
      {
        stack: {
          params: [...StackSpec['params'], [`peek:${Name}`, Param, { from: '$fp' }]];
          pushes: O['stack']['pushes'];
        };
      }
    >
  >;
  peeks<Name extends string, Args extends [type: SpecName, options?: { from: '$fp' }]>(
    name: Name,
    ...args: Args
  ) {
    this.#initializedStack().params.push([`peek:${name}`, ...args]);
    return this as any;
  }
}

interface InitialOpSpec<N extends VmOpName> {
  name: N;
  ops: [];
  stack: {
    params: [];
    pushes: [];
  };
  reads: [];
  changes: [];
  throws: false;
}

export function define<
  N extends VmOpName,
  const Build extends (define: Define<InitialOpSpec<N>>) => Define<OpSpec>,
>(
  name: N,
  build: Build
): Expand<
  ReturnType<Build> extends Define<infer O>
    ? {
        // sort the keys in the same order as OpSpec
        [P in keyof OpSpec]: O[P];
      }
    : never
> {
  const builder = new Define({
    name,
    ops: [],
    stack: { params: [], pushes: [] },
    reads: [],
    changes: [],
    throws: false,
  } satisfies InitialOpSpec<N>);
  const define = build(builder);
  return Define.done(define) as any;
}

define.throws = <
  N extends VmOpName,
  const Build extends (
    define: Define<Spread<InitialOpSpec<N>, { throws: true }>>
  ) => Define<OpSpec>,
>(
  name: N,
  build: Build
): Expand<
  ReturnType<Build> extends Define<infer O>
    ? {
        // sort the keys in the same order as OpSpec
        [P in keyof OpSpec]: O[P];
      }
    : never
> => {
  const builder = new Define({
    name,
    ops: [],
    stack: { params: [], pushes: [] },
    reads: [],
    changes: [],
    throws: true,
  } satisfies Spread<InitialOpSpec<N>, { throws: true }>);
  const define = build(builder);
  return Define.done(define) as any;
};
