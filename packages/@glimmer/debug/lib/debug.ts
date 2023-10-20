import type {
  CompileTimeConstants,
  Dict,
  Nullable,
  Recast,
  ResolutionTimeConstants,
  RuntimeOp,
  TemplateCompilationContext,
} from '@glimmer/interfaces';
import { LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';
import { decodeHandle, decodeImmediate, enumerate, LOCAL_LOGGER, unreachable } from '@glimmer/util';
import { $fp, $pc, $ra, $s0, $s1, $sp, $t0, $t1, $v0 } from '@glimmer/vm';

import { opcodeMetadata } from './opcode-metadata';
import type { Primitive } from './stack-check';

export interface DebugConstants {
  getValue<T>(handle: number): T;
  getArray<T>(value: number): T[];
}

export function debugSlice(context: TemplateCompilationContext, start: number, end: number) {
  if (LOCAL_TRACE_LOGGING) {
    LOCAL_LOGGER.group(`%c${start}:${end}`, 'color: #999');

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
        opcode,
        opcode.isMachine
      )!;

      LOCAL_LOGGER.debug(`${i}. ${logOpcode(name, params)}`);

      _size = opcode.size;
    }
    opcode.offset = -_size;
    LOCAL_LOGGER.groupEnd();
  }
}

export function logOpcode(type: string, params: Dict<DebugOperand>): string | void {
  if (LOCAL_TRACE_LOGGING) {
    let out = type;

    if (params) {
      let args = Object.entries(params)
        .map(([p, v]) => ` ${p}=${json(v)}`)
        .join('');
      out += args;
    }
    return `(${out})`;
  }
}

function stringify(value: number, type: 'constant'): string;
function stringify(value: RegisterName, type: 'register'): string;
function stringify(value: number, type: 'variable' | 'pc'): string;
function stringify(value: DebugOperand['value'], type: 'stringify' | 'unknown'): string;
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

function json(param: DebugOperand): string | string[] {
  switch (param.type) {
    case 'number':
    case 'boolean':
    case 'string':
    case 'primitive':
      return stringify(param.value, 'stringify');
    case 'array':
      if ('kind' in param) {
        return param.value;
      } else {
        return param.value.map((value) => stringify(value, 'unknown'));
      }
    case 'dynamic':
      return stringify(param.value, 'unknown');
    case 'constant':
      return stringify(param.value, 'constant');
    case 'register':
      return stringify(param.value, 'register');
    case 'pc':
      return stringify(param.value, 'pc');
    case 'variable':
      return stringify(param.value, 'variable');
    case 'error:opcode':
      return `{raw:${param.value}}`;
    case 'error:operand':
      return `{err:${param.kind}=${param.value}}`;
  }
}

export type RegisterName =
  | '$pc'
  | '$ra'
  | '$fp'
  | '$sp'
  | '$s0'
  | '$s1'
  | '$t0'
  | '$t1'
  | '$v0'
  | `$bug${number}`;

export type DebugOperand =
  | { type: 'error:operand'; kind: string; value: number }
  | { type: 'error:opcode'; kind: number; value: number }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'primitive'; value: Primitive }
  | { type: 'register'; value: RegisterName }
  | { type: 'pc'; value: number }
  /**
   * A variable is a numeric offset into the stack (relative to the $fp register).
   */
  | { type: 'variable'; value: number }
  | { type: 'dynamic'; value: unknown }
  | { type: 'constant'; value: number }
  | { type: 'string'; value: string; nullable?: false }
  | { type: 'string'; value: Nullable<string>; nullable: true }
  | { type: 'array'; value: unknown[] }
  | {
      type: 'array';
      value: string[];
      kind: typeof String;
    };

export function debug(
  c: DebugConstants,
  op: RuntimeOp,
  isMachine: 0 | 1
): [string, Dict<DebugOperand>] {
  if (LOCAL_TRACE_LOGGING) {
    let metadata = opcodeMetadata(op.type, isMachine);

    let out: Dict<DebugOperand> = Object.create(null);
    if (!metadata) {
      for (let i = 0; i < op.size; i++) {
        out[i] = { type: 'error:opcode', kind: op.type, value: i };
      }

      return [`{unknown ${op.type}}`, out];
    } else {
      for (const [index, operand] of enumerate(metadata.ops)) {
        let actualOperand = opcodeOperand(op, index);

        switch (operand.type) {
          case 'u32':
          case 'i32':
          case 'owner':
            out[operand.name] = { type: 'number', value: actualOperand };
            break;
          case 'handle':
            out[operand.name] = { type: 'constant', value: c.getValue(actualOperand) };
            break;
          case 'str':
            out[operand.name] = { type: 'string', value: c.getValue<string>(actualOperand) };
          case 'option-str':
            out[operand.name] = {
              type: 'string',
              value: c.getValue(actualOperand),
              nullable: true,
            };
            break;
          case 'array':
            out[operand.name] = {
              type: 'array',
              value: c.getArray<unknown>(actualOperand),
            };
          case 'str-array':
            out[operand.name] = {
              type: 'array',
              value: c.getArray<string>(actualOperand),
              kind: String,
            };
            break;
          case 'bool':
            out[operand.name] = { type: 'boolean', value: !!actualOperand };
            break;
          case 'primitive':
            out[operand.name] = { type: 'primitive', value: decodePrimitive(actualOperand, c) };
            break;
          case 'register':
            out[operand.name] = { type: 'register', value: decodeRegister(actualOperand) };
            break;
          case 'unknown':
            out[operand.name] = { type: 'dynamic', value: c.getValue(actualOperand) };
            break;
          case 'symbol-table':
          case 'scope':
            out[operand.name] = { type: 'variable', value: actualOperand };
            break;
          case 'pc':
            out[operand.name] = { type: 'pc', value: actualOperand };
            break;
          default:
            out[operand.name] = { type: 'error:operand', kind: operand.type, value: actualOperand };
        }
      }
      return [metadata.name, out];
    }
  }

  unreachable(`BUG: Don't try to debug opcodes while trace is disabled`);
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

function decodeRegister(register: number): RegisterName {
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

function decodePrimitive(primitive: number, constants: DebugConstants): Primitive {
  if (primitive >= 0) {
    return constants.getValue(decodeHandle(primitive));
  }
  return decodeImmediate(primitive);
}
