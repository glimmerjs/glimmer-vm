import type { Nullable, Optional, VmOpName } from '@glimmer/interfaces';
import type { NormalizedMetadata, DynamicStackFnSpec, StackCheck } from './metadata';
import { LOCAL_LOGGER, assertNever, fillNulls } from '@glimmer/util';
import { UNCHANGED, type STACK_TYPES } from './stack/params';
import { OpSize } from '@glimmer/vm';
import { LOCAL_DEBUG, LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import type { DebugOpList } from './generated/op-list';

type NameDef<Name extends Nullable<VmOpName> = VmOpName> = Name extends null
  ? null
  : `${Name} as ${string}`;

export function define(
  nameDef: NameDef,
  ops: ShorthandOperandList,
  stackCheck: StackCheck
): Nullable<NormalizedMetadata> {
  let [name, mnemonic] = nameDef.split(' as ') as [string, string];
  return {
    name,
    mnemonic,
    before: null,
    stackCheck,
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
export type ShorthandStackReturn<T extends StackType = StackType> = Extract<StackType, T>;

function op(input: ShorthandOp): Operand {
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
      type: 'stack:returns';
      value: ShorthandStackReturn[];
    }
  | {
      type: 'stack:dynamic';
      value: DynamicStackFnSpec | { reason: string };
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

function stackParams(params: ShorthandStackParam[]): {
  returns: (returns: IntoReturnType) => MetadataOption;
  pushes: (params: IntoReturnType<string>) => MetadataOption;
  dynamic: (dynamic: DynamicStackFnSpec | { reason: string }) => MetadataOption;
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

    dynamic: (dynamic: DynamicStackFnSpec | { reason: string }): MetadataOption => ({
      type: 'multi',
      options: [paramsOption, { type: 'stack:dynamic', value: dynamic }],
    }),
  };
}

function stackDynamic(dynamic: DynamicStackFnSpec | { reason: string }): MetadataOption {
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

  stackInfo.validate();

  return [operands, stackInfo.toStackCheck()];
}

class StackInfo {
  #params: ShorthandStackParam[] | undefined;
  #returns: ShorthandStackReturn[] | undefined;
  #delta: number | undefined;
  #dynamic: Optional<DynamicStackFnSpec | { reason: string }> = undefined;

  #validateNotContradictory(): void {
    if (this.#params || this.#returns) {
      if (this.#delta !== undefined) {
        throw new Error(
          `ERROR: IF stack params or stack returns are specified, stack delta must not be specified`
        );
      }
    } else if (this.#dynamic !== undefined) {
      if (this.#delta !== undefined) {
        throw new Error(
          `ERROR: IF opcode has a dynamic stack change, stack delta must not be specified`
        );
      }
    }
  }

  validate(): void {
    this.#validateNotContradictory();

    // also validate mutually required options
    if (this.#params || this.#returns) {
      if (!this.#returns && !this.#dynamic) {
        throw new Error(`ERROR: IF stack params are specified, stack returns must be specified`);
      }

      if (!this.#params && !this.#dynamic) {
        throw new Error(`ERROR: IF stack returns are specified, stack params must be specified`);
      }
    }
  }

  add(...options: StackOption[]): void {
    for (const option of options) {
      switch (option.type) {
        case 'stack:unchecked':
          this.#dynamic = { reason: option.reason };
          break;
        case 'stack:params':
          this.#params = option.value;
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

  toStackCheck(): StackCheck {
    const dynamic = this.#dynamic;

    if (dynamic === undefined) {
      return () => this.delta;
    }

    if (typeof dynamic === 'function') {
      const staticParams = this.#params?.length ?? 0;

      return (op, state) => {
        const diff = dynamic(op, state);
        if (typeof diff === 'number') return diff;

        const [first, ...rest] = diff;

        if (first === UNCHANGED) {
          return rest.length;
        } else {
          return diff.length - staticParams;
        }
      };
    } else {
      return { type: 'unchecked', ...dynamic };
    }
  }

  get delta(): number {
    if (this.#delta) {
      return this.#delta;
    } else {
      return (this.#returns?.length ?? 0) - (this.#params?.length ?? 0);
    }
  }
}

export type NormalizedMetadataArray<O> = {
  [K in keyof O]: O[K] extends null ? null : NormalizedMetadata;
};

export const RESERVED = Symbol('RESERVED');
export type RESERVED = typeof RESERVED;

type NormalizedOptions = [ops: ShorthandOperandList, check: StackCheck];

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
  #metadata: Nullable<NormalizedMetadata>[];

  private constructor(metadata: Nullable<NormalizedMetadata>[]) {
    this.#metadata = metadata;
  }

  declare NEXT: Rest[0];

  readonly stack = stack;
  readonly from = stackParams;

  readonly add = (
    name: Rest[0] extends null ? RESERVED : NameDef<NonNullable<Rest[0]>>,
    ...options: MetadataOption[]
  ): MetadataBuilder<Op, [...SoFar, Rest[0]], Slice<Rest>> => {
    // @fixme restore LOCAL_TRACE_LOGGING
    if (LOCAL_TRACE_LOGGING) {
      LOCAL_LOGGER.log('adding opcode', name, options);
    }

    if (name === RESERVED) {
      // @fixme restore LOCAL_TRACE_LOGGING
      if (LOCAL_TRACE_LOGGING) {
        LOCAL_LOGGER.log('reserving opcode', this.#inserting);
      }

      this.#inserting++;
    } else {
      const normalizedOptions =
        name === RESERVED
          ? ([[], { type: 'unchecked', reason: 'reserved' }] satisfies NormalizedOptions)
          : toOptions(options);

      this.#push(name, normalizedOptions);
    }

    return this as any;
  };

  #push(name: NameDef, options: NormalizedOptions): void {
    if (LOCAL_DEBUG) {
      LOCAL_LOGGER.log('adding opcode', this.#inserting, name, options);
    }

    this.#metadata[this.#inserting++] = name === null ? null : define(name, ...options);
  }

  #done(): NormalizedMetadataArray<Op> {
    return this.#metadata as NormalizedMetadataArray<Op>;
  }
}

type TupleToParams<T extends unknown[]> = (...args: T) => void;
type Slice<T extends unknown[]> = TupleToParams<T> extends (first: any, ...rest: infer Rest) => void
  ? Rest
  : never;
