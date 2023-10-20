import type { Nullable, Optional, VmMachineOpName, VmOpName } from '@glimmer/interfaces';
import type { NormalizedMetadata } from './metadata';
import { assertNever, fillNulls } from '@glimmer/util';
import type { JustOpNames, MachineOpNames } from '@glimmer/vm';
import { MachineOpSize } from '@glimmer/vm';

type NameDef = `${VmMachineOpName | VmOpName} as ${string}`;

export function define(
  nameDef: NameDef,
  ops: ShorthandOperandList,
  { stackChange, unchecked }: MetadataDefinition = {}
): NormalizedMetadata {
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

export const UNCHANGED = Symbol('UNCHANGED');

// @note STACK_TYPES
export const STACK_TYPES = [
  'block/template',
  'block/handle',
  'block/invocation',

  'component/definition',

  'scope',
  'table',
  'table?',
  'table/block',
  'bool',
  'args',
  // $pc or $ra
  'register/instruction',
  // $sp or $fp
  'register/stack',

  'reference/bool',
  'reference/any',
  'reference/fn',

  'i32',

  /**
   * {@linkcode ContentType | Content Type Enum}
   */
  'i32/ctype',

  'glimmer/iterator',

  UNCHANGED,
] as const;

export type StackType = (typeof STACK_TYPES)[number];

// @note OPERAND_TYPES
export const OPERAND_TYPES = [
  'u32',
  'i32',

  'pc',
  'owner',
  'handle',
  'const/str',
  'const/str?',
  'const/array/any',
  'const/array/str',
  'const/bool',
  'const/fn',
  'const/any',
  'const/primitive',

  'register',
  // $pc, $ra
  'register/instruction',
  // $sp, $fp
  'register/stack',
  // $s0, $s1, $t0, $t1, $v0
  'register/syscall',

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

type OpName = VmOpName | VmMachineOpName;

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

  if (stackInfo.params && stackInfo.returns) {
    if (definition.stackChange) {
      throw new Error(
        `IF stack params or stack returns are specified, stack change must not be (found ${JSON.stringify(
          options
        )})`
      );
    }

    definition.stackChange = stackReturns.length - stackParams.length;
  } else if (stackInfo.params || stackInfo.returns) {
    throw new Error(
      `IF stack params or stack returns are specified, both must be specified (found ${JSON.stringify(
        options
      )})`
    );
  } else if (dynamicStack) {
    definition.stackChange = null;
  }

  return [operands, definition];
}

export type NormalizedMetadataArray<O> = {
  [K in keyof O]: O[K] extends null ? null : NormalizedMetadata;
};

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export class MetadataBuilder<out Op, in out SoFar extends OpName[], in out Rest extends OpName[]> {
  static machine<T extends OpName[]>(
    build: (
      builder: MetadataBuilder<typeof MachineOpNames, [], Mutable<typeof MachineOpNames>>
    ) => MetadataBuilder<typeof MachineOpNames, T, any>
  ): { [P in keyof T]: NormalizedMetadata } {
    let builder = new MetadataBuilder<typeof MachineOpNames, [], Mutable<typeof MachineOpNames>>(
      fillNulls(MachineOpSize)
    );
    return build(builder).#done() as any;
  }

  static syscall<T extends OpName[]>(
    build: (
      builder: MetadataBuilder<typeof JustOpNames, [], Mutable<typeof JustOpNames>>
    ) => MetadataBuilder<typeof JustOpNames, T, any>
  ): { [P in keyof T]: NormalizedMetadata } {
    let builder = new MetadataBuilder<typeof JustOpNames, [], Mutable<typeof JustOpNames>>(
      fillNulls(MachineOpSize)
    );
    return build(builder).#done() as any;
  }

  #metadata: NormalizedMetadata[];

  private constructor(metadata: NormalizedMetadata[]) {
    this.#metadata = metadata;
  }

  declare NEXT: Rest[0];

  readonly stack = stack;
  readonly from = stackParams;
  readonly to = stackReturns;

  readonly add = (
    name: `${Rest[0]} as ${string}`,
    ...options: MetadataOption[]
  ): MetadataBuilder<Op, [...SoFar, Rest[0]], Slice<Rest>> => {
    this.#metadata.push(define(name, ...toOptions(options)));
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
