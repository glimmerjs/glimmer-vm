import type { Nullable, Optional, Reference, VmOpName } from '@glimmer/interfaces';
import type { OpcodeMetadata, DynamicStackFn } from './metadata';
import { assertNever, fillNulls } from '@glimmer/util';
import { UNCHANGED, type STACK_TYPES } from './stack/params';
import { OpSize } from '@glimmer/vm';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import type { DebugOpList } from './generated/op-list';
import { REFERENCE } from '@glimmer/reference';

type NameDef<Name extends Nullable<VmOpName> = VmOpName> = Name extends null
  ? null
  : `${Name} as ${string}`;

export function define(
  nameDef: NameDef,
  ops: ShorthandOperandList,
  stackCheck: DynamicStackFn
): Nullable<OpcodeMetadata> {
  let [name, mnemonic] = nameDef.split(' as ') as [string, string];
  return {
    name,
    mnemonic,
    before: null,
    stack: stackCheck,
    ops: ops.map(op) as OperandList,
    operands: ops.length,
  };
}

export interface CheckedMetadata {
  stackChange: number;
}

export interface UncheckedMetadata {
  reason: string;
}

export type MetadataDefinition = CheckedMetadata | UncheckedMetadata;

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
  'const/str?',
  'const/any[]',
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
  return OPERAND_TYPES.includes(s as any) || OPERAND_TYPES.includes(`${s}?` as any);
}

export type OPERAND_TYPE = (typeof OPERAND_TYPES)[number];
export type NonNullableOperandType = Exclude<OPERAND_TYPE, `${string}?`>;
export type NullableOperandType = Extract<OPERAND_TYPE, `${string}?`> extends `${infer S}?`
  ? S
  : never;
export type OperandType = NonNullableOperandType | NullableOperandType | `${NullableOperandType}?`;

export interface OperandLabel {
  type: OperandType;
  name: string;
}

export type OperandList =
  | []
  | [OperandLabel]
  | [OperandLabel, OperandLabel]
  | [OperandLabel, OperandLabel, OperandLabel];

export type ShorthandOperandList =
  | []
  | [ShorthandOp]
  | [ShorthandOp, ShorthandOp]
  | [ShorthandOp, ShorthandOp, ShorthandOp];

type ShorthandOp = `${string}:${OperandType}`;

type ShorthandStackParam = `${string}:${Exclude<StackType, symbol>}`;
export type ShorthandStackReturn<T extends StackType = StackType> = Extract<StackType, T>;

function op(input: ShorthandOp): OperandLabel {
  let [name, type] = input.split(':') as [string, string];

  if (isOperandType(type)) {
    return { name, type };
  } else {
    throw new Error(`Expected operand, found ${JSON.stringify(input)}`);
  }
}

type OpName = VmOpName;

export interface Op {
  readonly op1: number;
  readonly op2: number;
  readonly op3: number;
}
type StackOption =
  | {
      type: 'stack:unchecked';
      reason: string;
    }
  | {
      type: 'stack:delta';
      value: number;
    }
  | {
      type: 'stack:params';
      value: ShorthandStackParam[];
    }
  | {
      type: 'stack:peeks';
      value: ShorthandStackParam[];
    }
  | {
      type: 'stack:returns';
      value: ShorthandStackReturn[];
    }
  | {
      type: 'stack:dynamic';
      value: DynamicStackFn | { reason: string };
    };

type MetadataOption =
  | ShorthandOperandList
  | {
      type: 'multi';
      options: StackOption[];
    }
  | StackOption;

function stackDelta(change: number): MetadataOption {
  return { type: 'stack:delta', value: change };
}

export const stack = {
  peeks: stackPeeks,
  params: stackParams,
  dynamic: stackDynamic,
  delta: stackDelta,
} as const;

type IntoReturnType<T = ShorthandStackReturn> =
  | Extract<ShorthandStackReturn, T>
  | Extract<ShorthandStackReturn, T>[];

function intoReturnType(from: IntoReturnType): ShorthandStackReturn[] {
  return Array.isArray(from) ? from : [from];
}

function stackPeeks(
  params: ShorthandStackParam[]
): MetadataOption & { pushes: (returns: IntoReturnType) => MetadataOption } {
  return {
    type: 'stack:peeks',
    value: params,
    pushes: (returns) => ({
      type: 'multi',
      options: [
        { type: 'stack:peeks', value: params },
        { type: 'stack:returns', value: intoReturnType(returns) },
      ],
    }),
  };
}

function stackParams(params: ShorthandStackParam[]): {
  /**
   * Multiple returns mean multiple choices
   */
  returns: (returns: IntoReturnType) => MetadataOption;
  pushes: (params: IntoReturnType<string>) => MetadataOption;
  dynamic: (dynamic: DynamicStackFn | { reason: string }) => MetadataOption;
} {
  const paramsOption = { type: 'stack:params', value: params } as const;

  return {
    returns: (returns) => ({
      type: 'multi',
      options: [paramsOption, { type: 'stack:returns', value: intoReturnType(returns) }],
    }),

    pushes: (returns) => ({
      type: 'multi',
      options: [
        paramsOption,
        { type: 'stack:returns', value: [UNCHANGED, ...intoReturnType(returns)] },
      ],
    }),

    dynamic: (dynamic: DynamicStackFn | { reason: string }): MetadataOption => ({
      type: 'multi',
      options: [paramsOption, { type: 'stack:dynamic', value: dynamic }],
    }),
  };
}

function stackDynamic(dynamic: DynamicStackFn | { reason: string }): MetadataOption {
  return { type: 'stack:dynamic', value: dynamic ?? null };
}

// @active
function toOptions(options: MetadataOption[]): NormalizedOptions {
  let operands: ShorthandOperandList = [];

  const stackInfo = new StackInfo();

  for (let option of options) {
    if (Array.isArray(option)) {
      operands = option;
      continue;
    }

    switch (option.type) {
      case 'multi':
        stackInfo.add(...option.options);
        break;
      default:
        stackInfo.add(option);
    }
  }

  return [operands, stackInfo.toStackCheck()];
}

type StackParam =
  | { type: 'pop'; value: ShorthandStackParam }
  | { type: 'peek'; value: ShorthandStackParam };

class StackInfo {
  #params: StackParam[] = [];
  #returns: ShorthandStackReturn[] = [];
  #delta: number | undefined;
  #dynamic: Optional<DynamicStackFn | { reason: string }> = undefined;

  add(...options: StackOption[]): void {
    for (const option of options) {
      switch (option.type) {
        case 'stack:unchecked':
          this.#dynamic = { reason: option.reason };
          break;
        case 'stack:params':
          this.#params.push(
            ...option.value.map((param) => ({ type: 'pop', value: param }) as const)
          );
          break;
        case 'stack:peeks':
          this.#params.push(
            ...option.value.map((param) => ({ type: 'peek', value: param }) as const)
          );
          break;
        case 'stack:returns':
          this.#returns = option.value;
          break;
        case 'stack:delta':
          this.#delta = option.value;
          break;
        case 'stack:dynamic':
          this.#dynamic = option.value;
          break;
        default:
          assertNever(option);
      }
    }
  }

  toStackCheck(): DynamicStackFn {
    const dynamic = this.#dynamic;

    if (dynamic === undefined) {
      if (this.#delta) {
        return () => ({ type: 'delta', delta: this.delta });
      } else {
        return () => ({
          type: 'operations',
          peek: this.#peeks.length,
          pop: this.#pops.length,
          push: this.#returns.length,
          delta: this.delta,
        });
      }
    }

    if (typeof dynamic === 'function') {
      return dynamic;
    } else {
      return () => ({ type: 'unchecked', delta: undefined, ...dynamic });
    }
  }

  get #pops(): ShorthandStackParam[] {
    return this.#params.filter((p) => p.type === 'pop').map((p) => p.value);
  }

  get #peeks(): ShorthandStackParam[] {
    return this.#params.filter((p) => p.type === 'peek').map((p) => p.value);
  }

  get delta(): number {
    if (this.#delta) {
      return this.#delta;
    } else {
      return this.#returns.length - this.#pops.length;
    }
  }
}

export type NormalizedMetadataArray<O> = {
  [K in keyof O]: O[K] extends null ? null : OpcodeMetadata;
};

export const RESERVED = Symbol('RESERVED');
export type RESERVED = typeof RESERVED;

type NormalizedOptions = [ops: ShorthandOperandList, check: DynamicStackFn];

export class MetadataBuilder<
  out Op,
  in out SoFar extends Nullable<OpName>[],
  in out Rest extends Nullable<OpName>[],
> {
  static build<T extends Nullable<OpName>[]>(
    build: (
      builder: MetadataBuilder<DebugOpList, [], DebugOpList>
    ) => MetadataBuilder<DebugOpList, T, []>
  ): NormalizedMetadataArray<T> {
    let builder = new MetadataBuilder<DebugOpList, [], DebugOpList>(fillNulls(OpSize));
    return build(builder).#done() as any;
  }

  #inserting = 0;
  #metadata: Nullable<OpcodeMetadata>[];

  private constructor(metadata: Nullable<OpcodeMetadata>[]) {
    this.#metadata = metadata;
  }

  declare NEXT: Rest[0];

  readonly stack = stack;
  readonly from = stackParams;

  readonly add = (
    name: Rest[0] extends null ? RESERVED : NameDef<NonNullable<Rest[0]>>,
    ...options: MetadataOption[]
  ): MetadataBuilder<Op, [...SoFar, Rest[0]], Slice<Rest>> => {
    if (name === RESERVED) {
      this.#inserting++;
    } else {
      const normalizedOptions: NormalizedOptions =
        name === RESERVED
          ? ([
              [],
              () => ({ type: 'unchecked', reason: 'reserved', delta: undefined }),
            ] satisfies NormalizedOptions)
          : toOptions(options);

      this.#push(name, normalizedOptions);
    }

    return this as any;
  };

  #push(name: NameDef, options: NormalizedOptions): void {
    this.#metadata[this.#inserting++] = name === null ? null : define(name, ...options);
  }

  #done(): NormalizedMetadataArray<Op> {
    return this.#metadata as NormalizedMetadataArray<Op>;
  }
}

type TupleToParams<T extends unknown[]> = (...args: T) => void;
type Slice<T extends unknown[]> = TupleToParams<T> extends (first: any, ...rest: infer Rest) => void
  ? Rest
  : never;export function isReference(value: unknown): value is Reference {
  return !!(value && typeof value === 'object' && REFERENCE in value);
}

