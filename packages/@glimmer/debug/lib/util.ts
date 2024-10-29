import type { Nullable, RuntimeHeap, RuntimeOp } from '@glimmer/interfaces';
import { $s0, $s1 } from '@glimmer/vm';

import type { DebugConstants } from './debug';
import type { Operand } from './metadata';

// TODO: How do these map onto constant and machine types?
export const OPERAND_TYPES = [
  'u32',
  'i32',
  'owner',
  'helper',
  'str',
  'array',
  'bool',
  'primitive',
  'register',
  'unknown',
  'symbol-table',
  'scope',
] as const;

export const GENERIC = ['array', 'option'];
export const OPERAND_KINDS = ['immediate', 'const', 'register'] as const;

export function isOperandType(s: string): s is OperandType {
  return OPERAND_TYPES.indexOf(s as any) !== -1;
}

export function isOperandKind(s: string): s is OperandKind {
  return OPERAND_KINDS.indexOf(s as any) !== -1;
}

export type FullOperandType =
  | `${OperandKind}:${OperandType}`
  | `${GenericOperandType}<${OperandKind}:${OperandType}>`;

export interface OperandInfo {
  generic?: GenericOperandType | undefined;
  type: OperandType;
  kind: OperandKind;
}

export function parseOperandType(fullOperandType: FullOperandType): OperandInfo {
  if (fullOperandType.includes('<')) {
    const [generic, fullType] = fullOperandType.split(/[<>]/u) as [GenericOperandType, OperandType];
    const [kind, type] = fullType.split(':') as [OperandKind, OperandType];
    return { generic, type, kind };
  } else {
    const [type, kind] = fullOperandType.split(':') as [OperandType, OperandKind];
    return { type, kind };
  }
}

export type OperandType = (typeof OPERAND_TYPES)[number];
export type OperandKind = (typeof OPERAND_KINDS)[number];
export type GenericOperandType = (typeof GENERIC)[number];

export interface ShorthandOperand {
  type: `${OperandKind}:${OperandType}`;
  name: string;
}

export type ShorthandOperandList = (
  | []
  | [ShorthandOperand]
  | [ShorthandOperand, ShorthandOperand]
  | [ShorthandOperand, ShorthandOperand, ShorthandOperand]
) &
  ShorthandOperand[];

export interface NormalizedMetadata {
  name: string;
  mnemonic: string;
  stackChange: Nullable<number>;
  ops: ShorthandOperandList;
  operands: number;
  check: boolean;
}

interface VmState {
  constants: DebugConstants;
  heap: RuntimeHeap;
  op: RuntimeOp;
}

interface OperandTypeDesc<In, Out> {
  type: string;
  description: string;
  reason?: (value: In, state: VmState) => string;
  check: (value: In, state: VmState) => boolean;
  decode: (value: In, state: VmState) => Out;
}

export class DebugDecoder {
  readonly #state: VmState;

  constructor(state: VmState) {
    this.#state = state;
  }

  decode<In, Out>(value: In, type: OperandTypeDesc<In, Out>, operand: Operand): Out {
    const state = this.#state;

    const checked = type.check(value, state);

    if (!checked) {
      const reason = type.reason
        ? type.reason(value, state)
        : `Invalid ${type.type} (${operand.name}: ${operand.type} = ${value})`;
      throw new Error(`[BUG IN DEBUGGER] ${reason}`);
    }

    return type.decode(value, state);
  }
}

export const INLINE: OperandTypeDesc<number, number> = {
  type: 'inline',
  description: 'An inline operand is encoded directly in the instruction.',
  check: (value) => isInt(value),
  decode: (value) => value,
};

export const RELATIVE_PC: OperandTypeDesc<number, number> = {
  type: 'pc-target',
  description: 'A $pc target is relative to the current $pc.',
  check: (value) => isInt(value),
  decode: (value, state) => {
    return state.op.offset + value;
  },
};

export const SAVED_REGISTER: OperandTypeDesc<number, unknown> = {
  type: 'saved-register',
  description: 'A saved register is any value stored in $s0 or $s1.',
  check: (value) => value === $s0 || value === $s1,
  decode: (value) => {
    switch (value) {
      case $s0:
        return '$s0';
      case $s1:
        return '$s1';
    }
  },
};

export const SYMBOL: OperandTypeDesc<number, string | number> = {
  type: 'symbol',
  description: 'A symbol is encoded as a string.',
  check: () => true,
  decode: (value) => {
    return value === 0 ? 'this' : value;
  },
};

export const BLOCK_HANDLE: OperandTypeDesc<number, number> = {
  type: 'block-handle',
  description:
    'A block handle is encoded as a positive integer and is a pointer to an entry in the program table.',
  check: (value, { heap }) => isInt(value) && heap.entries() > value,
  reason: (value, { heap }) => {
    return `Invalid block handle (${value}, block handle must be in the range [0, ${heap.entries()})`;
  },
  decode: (value, { heap }) => heap.getaddr(value),
};

export class ConstHandle<T> implements OperandTypeDesc<number, T> {
  readonly type = 'const-handle';
  readonly description =
    'A const handle is encoded as a positive integer and is a pointer to an entry in the constant table.';

  check(value: number, state: VmState) {
    return state.constants.hasHandle(value);
  }

  decode(value: number, state: VmState): T {
    return state.constants.getValue(value);
  }
}

export const U32: OperandTypeDesc<number, number> = {
  type: 'u32',
  description: `A u32 is a 32-bit unsigned integer. It must be in the range [0, ${Number.MAX_SAFE_INTEGER}].`,
  check: (value: number) => isInt(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER,
  decode: (value: number) => value,
};

export const I32: OperandTypeDesc<number, number> = {
  type: 'i32',
  description: `An i32 is a 32-bit signed integer. It must be in the range [${Number.MIN_SAFE_INTEGER}, ${Number.MAX_SAFE_INTEGER}].`,
  check: (value: number) =>
    isInt(value) && value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER,
  decode: (value: number) => value,
};

type AnyFn = (...args: any[]) => any;

export const HELPER: OperandTypeDesc<unknown, AnyFn> = {
  type: 'helper',
  description: 'A helper is encoded as a constant handle to a function value.',
  check: (value: unknown) => typeof value === 'function',
  decode: (value: unknown) => value as AnyFn,
};

function isInt(value: number) {
  return typeof value === 'number' && value % 1 === 0 && value <= Number.MAX_SAFE_INTEGER;
}
