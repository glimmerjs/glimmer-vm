import type {
  CompileTimeConstants,
  Dict,
  Maybe,
  Recast,
  ResolutionTimeConstants,
  RuntimeHeap,
  RuntimeOp,
  TemplateCompilationContext,
} from '@glimmer/interfaces';
import type { Register } from '@glimmer/vm';
import { LOCAL_SHOULD_LOG } from '@glimmer/local-debug-flags';
import { assertNever, decodeHandle, decodeImmediate, enumerate, LOCAL_LOGGER } from '@glimmer/util';
import { $fp, $pc, $ra, $s0, $s1, $sp, $t0, $t1, $v0 } from '@glimmer/vm';

import type { Primitive } from './stack-check';

import { opcodeMetadata } from './opcode-metadata';
import {
  ConstHandle,
  DebugDecoder,
  HELPER,
  INLINE,
  RELATIVE_PC,
  SAVED_REGISTER,
  SYMBOL,
  U32,
} from './util';

export interface DebugConstants {
  hasHandle(handle: number): boolean;
  getValue<T>(handle: number): T;
  getArray<T>(value: number): T[];
}

export function debugSlice(context: TemplateCompilationContext, start: number, end: number) {
  if (LOCAL_SHOULD_LOG) {
    LOCAL_LOGGER.group(`block -> %c${start}:${end}`, 'color: #999');

    let heap = context.program.heap;
    let opcode = context.program.createOp(heap);

    let _size = 0;
    for (let i = start; i < end; i = i + _size) {
      opcode.offset = i;
      let [name, params] = debug(
        context.program.constants as Recast<
          CompileTimeConstants & ResolutionTimeConstants,
          DebugConstants
        >,
        context.program.heap,
        opcode,
        opcode.isMachine
      )!;
      LOCAL_LOGGER.log(`${i}. ${logOpcode(name, params)}`);
      _size = opcode.size;
    }
    opcode.offset = -_size;
    LOCAL_LOGGER.groupEnd();
  }
}

export function logOpcode(type: string, params: Maybe<Dict>): string | void {
  if (LOCAL_SHOULD_LOG) {
    let out = type;

    if (params) {
      let args = Object.keys(params)
        .map((p) => ` ${p}=${json(params[p])}`)
        .join('');
      out += args;
    }
    return `(${out})`;
  }
}

function json(param: unknown) {
  if (LOCAL_SHOULD_LOG) {
    if (typeof param === 'function') {
      return '<function>';
    }

    let string;
    try {
      string = JSON.stringify(param);
    } catch (e) {
      return '<object>';
    }

    if (string === undefined) {
      return 'undefined';
    }

    let debug = JSON.parse(string);
    if (typeof debug === 'object' && debug !== null && debug.GlimmerDebug !== undefined) {
      return debug.GlimmerDebug;
    }

    return string;
  }
}

export function debug(
  c: DebugConstants,
  heap: RuntimeHeap,
  op: RuntimeOp,
  isMachine: 0 | 1
): [string, Dict] | undefined {
  if (LOCAL_SHOULD_LOG) {
    const decoder = new DebugDecoder({ constants: c, heap, op });
    let metadata = opcodeMetadata(op.type, isMachine);

    if (!metadata) {
      throw new Error(`Missing Opcode Metadata for ${op.type}`);
    }

    let out = Object.create(null);

    for (const [index, operand] of enumerate(metadata.ops)) {
      let actualOperand = opcodeOperand(op, index);

      switch (operand.type) {
        case 'inline:u32': {
          const inline = decoder.decode(actualOperand, INLINE, operand);
          out[operand.name] = decoder.decode(inline, U32, operand);
          break;
        }
        case 'inline:relative-pc': {
          const inline = decoder.decode(actualOperand, INLINE, operand);
          out[operand.name] = decoder.decode(inline, RELATIVE_PC, operand);
          break;
        }
        case 'const:helper': {
          const constant = decoder.decode(actualOperand, new ConstHandle(), operand);
          out[operand.name] = decoder.decode(constant, HELPER, operand);
          break;
        }
        case 'register:saved': {
          out[operand.name] = decoder.decode(actualOperand, SAVED_REGISTER, operand);
          break;
        }
        case 'symbol':
          out[operand.name] = decoder.decode(actualOperand, SYMBOL, operand);
          break;
        case 'u32':
        case 'i32':
        case 'owner':
          out[operand.name] = actualOperand;
          break;
        case 'handle':
          out[operand.name] = c.getValue(actualOperand);
          break;
        case 'str':
        case 'option-str':
        case 'array':
          out[operand.name] = c.getValue(actualOperand);
          break;
        case 'str-array':
          out[operand.name] = c.getArray(actualOperand);
          break;
        case 'bool':
          out[operand.name] = !!actualOperand;
          break;
        case 'primitive':
          out[operand.name] = decodePrimitive(actualOperand, c);
          break;
        case 'register':
          out[operand.name] = decodeRegister(actualOperand);
          break;
        case 'unknown':
          out[operand.name] = c.getValue(actualOperand);
          break;
        case 'symbol-table':
        case 'scope':
          out[operand.name] = `<scope ${actualOperand}>`;
          break;
        default:
          assertNever(operand.type);
      }
    }

    return [metadata.name, out];
  }

  return undefined;
}

function opcodeOperand(opcode: RuntimeOp, index: number): number {
  switch (index) {
    case 0:
      return opcode.op1;
    case 1:
      return opcode.op2;
    case 2:
      return opcode.op3;
    default:
      throw new Error(`Unexpected operand index (must be 0-2)`);
  }
}

function decodeRegister(register: Register): string {
  switch (register) {
    case $pc:
      return 'pc';
    case $ra:
      return 'ra';
    case $fp:
      return 'fp';
    case $sp:
      return 'sp';
    case $s0:
      return 's0';
    case $s1:
      return 's1';
    case $t0:
      return 't0';
    case $t1:
      return 't1';
    case $v0:
      return 'v0';
  }
}

function decodePrimitive(primitive: number, constants: DebugConstants): Primitive {
  if (primitive >= 0) {
    return constants.getValue(decodeHandle(primitive));
  }
  return decodeImmediate(primitive);
}
