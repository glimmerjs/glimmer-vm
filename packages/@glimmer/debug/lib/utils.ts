import type { Nullable, Optional, VmOpName } from '@glimmer/interfaces';
import type { NormalizedMetadata } from './metadata';
import { assertNever, fillNulls } from '@glimmer/util';
import { OpSize, type OpNames } from '@glimmer/vm';
import type { STACK_TYPES } from './stack/params';

type NameDef<Name extends Nullable<VmOpName> = VmOpName> = Name extends null
  ? null
  : `${Name} as ${string}`;

export function define(
  nameDef: NameDef,
  ops: ShorthandOperandList,
  { stackChange, unchecked }: MetadataDefinition = {}
): Nullable<NormalizedMetadata> {
  let [name, mnemonic] = nameDef.split(' as ') as [string, string];
  return {
    name,
    mnemonic,
    before: null,
    stackChange: stackChange ?? null,
    ops: ops.map(op) as OperandList,
    operands: ops.length,
    check: unchecked ? { type: 'unchecked', reason: unchecked.reason } : { type: 'checked' },
  };
}

export interface MetadataDefinition {
  // @premerge consolidate unchecked
  // null means unchecked stack change
  stackChange?: number | null;
  unchecked?: Optional<{
    reason: string;
  }>;
}

export type StackType = (typeof STACK_TYPES)[number];

// @note OPERAND_TYPES
export const OPERAND_TYPES = [
  // imm means immediate
  'imm/u32',
  'imm/i32',
  // encoded as 0 or 1
  'imm/bool',
  // the operand is an i32 or u32, but it has a more specific meaning that should be captured here
  'imm/u32{todo}',
  'imm/i32{todo}',

  'imm/enum<curry>',
  'imm/block:handle',

  'imm/pc',
  'handle',

  'const/i32[]',
  'const/str',
  'const/str?',
  'const/any[]',
  'const/str[]',
  'const/str[]?',
  'const/bool',
  'const/fn',
  'const/any',

  // could be an immediate
  'const/primitive',
  'const/definition',

  'register',
  // $pc, $ra
  'register/instruction',
  // $sp, $fp
  'register/stack',
  // $s0, $s1, $t0, $t1, $v0
  'register/sN',
  'register/tN',
  'register/v0',

  'variable',

  'instruction/relative',
  'instruction/absolute',
] as const;

export function isOperandType(s: string): s is OperandType {
  return OPERAND_TYPES.indexOf(s as any) !== -1;
}

export type OperandType = (typeof OPERAND_TYPES)[number];

export interface Operand {
  type: OperandType;
  name: string;
}

export type OperandList = ([] | [Operand] | [Operand, Operand] | [Operand, Operand, Operand]) &
  Operand[];

export type ShorthandOperandList =
  | []
  | [ShorthandOp]
  | [ShorthandOp, ShorthandOp]
  | [ShorthandOp, ShorthandOp, ShorthandOp];

type ShorthandOp = `${string}:${OperandType}`;

type ShorthandStackParam = `${string}:${Exclude<StackType, symbol>}`;
type ShorthandStackReturn = StackType;

function op(input: ShorthandOp): Operand {
  let [name, type] = input.split(':') as [string, string];

  if (isOperandType(type)) {
    return { name, type };
  } else {
    throw new Error(`Expected operand, found ${JSON.stringify(input)}`);
  }
}

type OpName = VmOpName;

interface Op {
  readonly op1: number;
  readonly op2: number;
  readonly op3: number;
}
type DynamicStackFn = (op: Op) => number;

type MetadataOption =
  | ShorthandOperandList
  | {
      type: 'unchecked';
      reason: string;
    }
  | {
      type: 'stack:change';
      value: number;
    }
  | {
      type: 'stack:params';
      value: ShorthandStackParam[];
    }
  | {
      type: 'stack:returns';
      value: ShorthandStackReturn[];
    }
  | {
      type: 'stack:dynamic';
      value: Nullable<DynamicStackFn>;
    };

function stack(change: number): MetadataOption {
  return { type: 'stack:change', value: change };
}

stack.params = stackParams;
stack.returns = stackReturns;
stack.dynamic = stackDynamic;

function stackParams(params: ShorthandStackParam[]): MetadataOption {
  return { type: 'stack:params', value: params };
}

function stackReturns(returns: ShorthandStackReturn[]): MetadataOption {
  return { type: 'stack:returns', value: returns };
}

function stackDynamic(dynamic?: DynamicStackFn): MetadataOption {
  return { type: 'stack:dynamic', value: dynamic ?? null };
}

function toOptions(
  op: string,
  options: MetadataOption[]
): [operands: ShorthandOperandList, options: MetadataDefinition] {
  let operands: ShorthandOperandList = [];
  let definition: MetadataDefinition = {};

  let stackInfo = {
    params: undefined as ShorthandStackParam[] | undefined,
    returns: undefined as ShorthandStackReturn[] | undefined,
  };

  let dynamicStack = false;

  for (let option of options) {
    if (Array.isArray(option)) {
      operands = option;
      continue;
    }

    switch (option.type) {
      case 'stack:change':
        definition.stackChange = option.value;
        break;
      case 'unchecked':
        definition.unchecked = option;
        break;
      case 'stack:params':
        stackInfo.params = option.value;
        break;
      case 'stack:returns':
        stackInfo.returns = option.value;
        break;
      case 'stack:dynamic':
        dynamicStack = true;
        break;
      default:
        assertNever(option);
    }
  }

  if (stackInfo.params) {
    if (definition.stackChange) {
      throw new Error(
        `ERROR in ${op}: IF stack params or stack returns are specified, stack change must not be (found ${JSON.stringify(
          options
        )})`
      );
    }

    if (stackInfo.returns) {
      definition.stackChange = stackReturns.length - stackParams.length;
    } else if (dynamicStack) {
      definition.stackChange = null;
    } else {
      throw new Error(
        `ERROR in ${op}: IF stack params are specified, stack returns must be specified (found ${JSON.stringify(
          options
        )})`
      );
    }
  } else if (stackInfo.returns) {
    throw new Error(
      `ERROR in ${op}: IF stack stack returns are specified, stack params must be specified (found ${JSON.stringify(
        options
      )})`
    );
  } else if (dynamicStack) {
    definition.stackChange = null;
  } else {
    definition.stackChange = 0;
  }

  return [operands, definition];
}

export type NormalizedMetadataArray<O> = {
  [K in keyof O]: O[K] extends null ? null : NormalizedMetadata;
};

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export const RESERVED = Symbol('RESERVED');
export type RESERVED = typeof RESERVED;

export class MetadataBuilder<
  out Op,
  in out SoFar extends Nullable<OpName>[],
  in out Rest extends Nullable<OpName>[],
> {
  static build<T extends Nullable<OpName>[]>(
    build: (
      builder: MetadataBuilder<typeof OpNames, [], Mutable<typeof OpNames>>
    ) => MetadataBuilder<typeof OpNames, T, any>
  ): NormalizedMetadataArray<T> {
    let builder = new MetadataBuilder<typeof OpNames, [], Mutable<typeof OpNames>>(
      fillNulls(OpSize)
    );
    return build(builder).#done() as any;
  }

  #metadata: Nullable<NormalizedMetadata>[];

  private constructor(metadata: Nullable<NormalizedMetadata>[]) {
    this.#metadata = metadata;
  }

  declare NEXT: Rest[0];

  readonly stack = stack;
  readonly from = stackParams;
  readonly to = stackReturns;

  readonly add = (
    name: Rest[0] extends null ? RESERVED : NameDef<NonNullable<Rest[0]>>,
    ...options: MetadataOption[]
  ): MetadataBuilder<Op, [...SoFar, Rest[0]], Slice<Rest>> => {
    if (name === RESERVED) {
      this.#metadata.push(null);
    } else {
      const normalizedOptions: Slice<Parameters<typeof define>> =
        name === RESERVED ? [[]] : toOptions(name.split(' as ')[0] as string, options);
      this.#metadata.push(define(name, ...normalizedOptions));
    }

    return this as any;
  };

  #done(): NormalizedMetadataArray<Op> {
    return this.#metadata as NormalizedMetadataArray<Op>;
  }
}

type TupleToParams<T extends unknown[]> = (...args: T) => void;
type Slice<T extends unknown[]> = TupleToParams<T> extends (first: any, ...rest: infer Rest) => void
  ? Rest
  : never;
