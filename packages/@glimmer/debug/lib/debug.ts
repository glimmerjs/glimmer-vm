import type {
  BlockMetadata,
  CompilationContext,
  DebugOp,
  Dict,
  OpSnapshot,
  Primitive,
  Program,
  ProgramConstants,
  RawDisassembledOperand,
  RegisterName,
  RuntimeOp,
  SomeDisassembledOperand,
} from '@glimmer/interfaces';
import {
  CURRIED_COMPONENT,
  CURRIED_HELPER,
  CURRIED_MODIFIER,
  decodeHandle,
  decodeImmediate,
} from '@glimmer/constants';
import { exhausted, expect, unreachable } from '@glimmer/debug-util';
import { LOCAL_DEBUG, LOCAL_SUBTLE_LOGGING, LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';
import { enumerate, LOCAL_LOGGER } from '@glimmer/util';
import { $fp, $pc, $ra, $s0, $s1, $sp, $t0, $t1, $v0 } from '@glimmer/vm';

import type { NormalizedOperand, OperandType, ShorthandOperand } from './dism/operand-types';

import { describeOp } from './dism/opcode';
import { OPERANDS } from './dism/operands';
import { opcodeMetadata } from './opcode-metadata';
import { frag } from './render/fragment';
import { DebugLogger } from './render/logger';

export function logOpcodeSlice(context: CompilationContext, start: number, end: number) {
  if (LOCAL_TRACE_LOGGING) {
    const logger = new DebugLogger(LOCAL_LOGGER, { showSubtle: !!LOCAL_SUBTLE_LOGGING });
    LOCAL_LOGGER.group(`%c${start}:${end}`, 'color: #999');

    const program = context.evaluation.program;

    let heap = program.heap;
    let opcode = context.evaluation.createOp(heap);

    let _size = 0;
    for (let i = start; i <= end; i = i + _size) {
      opcode.offset = i;
      const op = describeOp(opcode, program, context.meta);

      logger.log(frag`${i}. ${op}`);

      _size = opcode.size;
    }
    opcode.offset = -_size;
    LOCAL_LOGGER.groupEnd();
  }
}

export function describeOpcode(type: string, params: Dict<SomeDisassembledOperand>): string | void {
  if (LOCAL_DEBUG) {
    let out = type;

    if (params) {
      let args = Object.entries(params)
        .map(([p, v]) => ` ${p}=${jsonify(v)}`)
        .join('');
      out += args;
    }
    return `(${out})`;
  }
}

function stringify(value: number, type: 'constant'): string;
function stringify(value: RegisterName, type: 'register'): string;
function stringify(value: number, type: 'variable' | 'pc'): string;
function stringify(value: DisassembledOperand['value'], type: 'stringify' | 'unknown'): string;
function stringify(
  value: unknown,
  type: 'stringify' | 'constant' | 'register' | 'variable' | 'pc' | 'unknown'
) {
  switch (type) {
    case 'stringify':
      return JSON.stringify(value);
    case 'constant':
      return `${stringify(value, 'unknown')}`;
    case 'register':
      return value;
    case 'variable':
      return `{$fp+${value}}`;
    case 'pc':
      return `@${value}`;
    case 'unknown': {
      switch (typeof value) {
        case 'function':
          return '<function>';
        case 'number':
        case 'string':
        case 'bigint':
        case 'boolean':
          return JSON.stringify(value);
        case 'symbol':
          return `${String(value)}`;
        case 'undefined':
          return 'undefined';
        case 'object': {
          if (value === null) return 'null';
          if (Array.isArray(value)) return `<array[${value.length}]>`;

          let name = value.constructor.name;

          switch (name) {
            case 'Error':
            case 'RangeError':
            case 'ReferenceError':
            case 'SyntaxError':
            case 'TypeError':
            case 'WeakMap':
            case 'WeakSet':
              return `<${name}>`;
            case 'Object':
              return `<${name}>`;
          }

          if (value instanceof Map) {
            return `<Map[${value.size}]>`;
          } else if (value instanceof Set) {
            return `<Set[${value.size}]>`;
          } else {
            return `<${name}>`;
          }
        }
      }
    }
  }
}

function jsonify(param: SomeDisassembledOperand): string | string[] | null {
  const result = json(param);

  return Array.isArray(result) ? JSON.stringify(result) : result ?? 'null';
}

function json(param: SomeDisassembledOperand): string | string[] | null {
  switch (param.type) {
    case 'number':
    case 'boolean':
    case 'string':
    case 'primitive':
      return stringify(param.value, 'stringify');
    case 'array':
      return '<array>';
    case 'dynamic':
      return stringify(param.value, 'unknown');
    case 'constant':
      return stringify(param.value, 'constant');
    case 'register':
      return stringify(param.value, 'register');
    case 'instruction':
      return stringify(param.value, 'pc');
    case 'variable':
      return stringify(param.value, 'variable');
    case 'error:opcode':
      return `{raw:${param.value}}`;
    case 'error:operand':
      return `{err:${param.options.label.name}=${param.value}}`;
    case 'enum<curry>':
      return `<curry:${param.value}>`;

    default:
      exhausted(param);
  }
}

export class DisassembledOperand<R extends RawDisassembledOperand = RawDisassembledOperand> {
  static of(raw: RawDisassembledOperand): SomeDisassembledOperand {
    return new DisassembledOperand(raw) as never;
  }

  readonly #raw: R;

  private constructor(raw: R) {
    this.#raw = raw;
  }

  get type(): R[0] {
    return this.#raw[0];
  }

  get value(): R[1] {
    return this.#raw[1];
  }

  get options(): R[2] {
    return this.#raw[2];
  }
}

export function getOpSnapshot(op: RuntimeOp): OpSnapshot {
  return {
    offset: op.offset,
    size: op.size,
    type: op.type,
    op1: op.op1,
    op2: op.op2,
    op3: op.op3,
  };
}

class DebugOperandInfo {
  readonly #offset: number;
  readonly #operand: NormalizedOperand;
  readonly #value: number;
  readonly #program: Program;
  readonly #metadata: BlockMetadata | null;

  constructor(
    offset: number,
    operand: NormalizedOperand,
    value: number,
    program: Program,
    metadata: BlockMetadata | null
  ) {
    this.#offset = offset;
    this.#operand = operand;
    this.#value = value;
    this.#program = program;
    this.#metadata = metadata;
  }

  toDebug(): RawDisassembledOperand {
    const spec = expect(
      OPERANDS[this.#operand.type],
      `Unknown operand type: ${this.#operand.type}`
    );

    return spec({
      offset: this.#offset,
      label: this.#operand,
      value: this.#value,
      constants: this.#program.constants,
      heap: this.#program.heap,
      meta: this.#metadata,
    });
  }
}

export function debugOp(program: Program, op: OpSnapshot, meta: BlockMetadata | null): DebugOp {
  if (LOCAL_DEBUG) {
    let metadata = opcodeMetadata(op.type);

    let out: Dict<RawDisassembledOperand> = Object.create(null);
    if (!metadata) {
      for (let i = 0; i < op.size; i++) {
        out[i] = ['error:opcode', i, { kind: op.type }];
      }

      return { name: `{unknown ${op.type}}`, params: fromRaw(out), meta };
    } else if (metadata.ops) {
      for (const [index, operand] of enumerate(metadata.ops)) {
        const normalized = normalizeOperand(operand);
        const info = new DebugOperandInfo(
          op.offset,
          normalized,
          getOperand(op, index as 0 | 1 | 2),
          program,
          meta
        );
        out[normalized.name] = info.toDebug();
      }
    }
    return { name: metadata.name, params: fromRaw(out), meta };
  }

  throw unreachable(`BUG: Don't try to debug opcodes while trace is disabled`);
}

function normalizeOperand(operand: ShorthandOperand): NormalizedOperand {
  const [name, type] = operand.split(':') as [string, OperandType];
  return { name, type };
}

function getOperand(op: OpSnapshot, index: 0 | 1 | 2): number {
  switch (index) {
    case 0:
      return op.op1;
    case 1:
      return op.op2;
    case 2:
      return op.op3;
  }
}

function fromRaw(operands: Dict<RawDisassembledOperand>): Dict<SomeDisassembledOperand> {
  return Object.fromEntries(
    Object.entries(operands).map(([name, raw]) => [name, DisassembledOperand.of(raw)])
  );
}

export function decodeCurry(curry: number): 'component' | 'helper' | 'modifier' {
  switch (curry) {
    case CURRIED_COMPONENT:
      return 'component';
    case CURRIED_HELPER:
      return 'helper';
    case CURRIED_MODIFIER:
      return 'modifier';
    default:
      throw Error(`Unexpected curry value: ${curry}`);
  }
}

export function decodeRegister(register: number): RegisterName {
  switch (register) {
    case $pc:
      return '$pc';
    case $ra:
      return '$ra';
    case $fp:
      return '$fp';
    case $sp:
      return '$sp';
    case $s0:
      return '$s0';
    case $s1:
      return '$s1';
    case $t0:
      return '$t0';
    case $t1:
      return '$t1';
    case $v0:
      return '$v0';
    default:
      return `$bug${register}`;
  }
}

export function decodePrimitive(primitive: number, constants: ProgramConstants): Primitive {
  if (primitive >= 0) {
    return constants.getValue(decodeHandle(primitive));
  }
  return decodeImmediate(primitive);
}
