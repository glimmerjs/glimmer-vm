import { InstructionEncoderImpl } from '@glimmer/encoder';
import type {
  BuilderOp,
  BuilderOpcode,
  CompileTimeConstants,
  CompileTimeHeap,
  CompileTimeResolver,
  ContainingMetadata,
  Dict,
  Encoder,
  EncoderError,
  HandleResult,
  HighLevelOp,
  InstructionEncoder,
  Operand,
  ResolutionTimeConstants,
  STDLibrary,
  SingleBuilderOperand,
} from '@glimmer/interfaces';
import {
  assert,
  dict,
  EMPTY_STRING_ARRAY,
  encodeHandle,
  expect,
  isPresentArray,
  Stack,
} from '@glimmer/util';
import {
  ARG_SHIFT,
  isMachineOp,
  MACHINE_MASK,
  PRIMITIVE_OP,
  RETURN_OP,
  TYPE_SIZE,
} from '@glimmer/vm-constants';

import { compilableBlock } from '../compilable-template';
import {
  resolveComponent,
  resolveComponentOrHelper,
  resolveHelper,
  resolveModifier,
  resolveOptionalComponentOrHelper,
  resolveOptionalHelper,
} from './helpers/resolution';
import {
  LABEL_OP,
  RESOLVE_COMPONENT,
  RESOLVE_COMPONENT_OR_HELPER,
  RESOLVE_FREE,
  RESOLVE_HELPER,
  RESOLVE_LOCAL,
  RESOLVE_MODIFIER,
  RESOLVE_OPTIONAL_COMPONENT_OR_HELPER,
  RESOLVE_OPTIONAL_HELPER,
  RESOLVE_TEMPLATE_LOCAL,
  START_LABELS_OP,
  START_OP,
  STOP_LABELS_OP,
} from './opcodes';
import {
  BLOCK_OPERAND,
  DEBUG_SYMBOLS_OPERAND,
  IS_STRICT_MODE_OPERAND,
  LABEL_OPERAND,
  LAYOUT_OPERAND,
  NON_SMALL_INT_OPERAND,
  STD_LIB_OPERAND,
  SYMBOL_TABLE_OPERAND,
} from './operands';

export class Labels {
  labels: Dict<number> = dict();
  targets: Array<{ at: number; target: string }> = [];

  label(name: string, index: number) {
    this.labels[name] = index;
  }

  target(at: number, target: string) {
    this.targets.push({ at, target });
  }

  patch(heap: CompileTimeHeap): void {
    let { targets, labels } = this;

    for (const { at, target } of targets) {
      let address = labels[target]! - at;

      assert(heap.getbyaddr(at) === -1, 'Expected heap to contain a placeholder, but it did not');

      heap.setbyaddr(at, address);
    }
  }
}

export function encodeOp(
  encoder: Encoder,
  constants: CompileTimeConstants & ResolutionTimeConstants,
  resolver: CompileTimeResolver,
  meta: ContainingMetadata,
  op: BuilderOp | HighLevelOp
): void {
  if (isBuilderOpcode(op[0])) {
    let [type, ...operands] = op;
    encoder.push(constants, type, ...(operands as SingleBuilderOperand[]));
  } else {
    switch (op[0]) {
      case LABEL_OP:
        return encoder.label(op[1]);
      case START_LABELS_OP:
        return encoder.startLabels();
      case STOP_LABELS_OP:
        return encoder.stopLabels();

      case RESOLVE_COMPONENT:
        return resolveComponent(resolver, constants, meta, op);
      case RESOLVE_MODIFIER:
        return resolveModifier(resolver, constants, meta, op);
      case RESOLVE_HELPER:
        return resolveHelper(resolver, constants, meta, op);
      case RESOLVE_COMPONENT_OR_HELPER:
        return resolveComponentOrHelper(resolver, constants, meta, op);
      case RESOLVE_OPTIONAL_HELPER:
        return resolveOptionalHelper(resolver, constants, meta, op);
      case RESOLVE_OPTIONAL_COMPONENT_OR_HELPER:
        return resolveOptionalComponentOrHelper(resolver, constants, meta, op);

      case RESOLVE_LOCAL: {
        let freeVariable = op[1];
        let name = expect(meta.upvars, 'BUG: attempted to resolve value but no upvars found')[
          freeVariable
        ]!;

        let andThen = op[2];
        andThen(name, meta.moduleName);

        break;
      }

      case RESOLVE_TEMPLATE_LOCAL: {
        let [, valueIndex, then] = op;
        let value = expect(
          meta.scopeValues,
          'BUG: Attempted to gect a template local, but template does not have any'
        )[valueIndex];

        then(constants.value(value));

        break;
      }

      case RESOLVE_FREE:
        if (import.meta.env.DEV) {
          let [, upvarIndex] = op;
          let freeName = expect(meta.upvars, 'BUG: attempted to resolve value but no upvars found')[
            upvarIndex
          ];

          throw new Error(
            `Attempted to resolve a value in a strict mode template, but that value was not in scope: ${freeName}`
          );
        }
        break;

      default:
        throw new Error(`Unexpected high level opcode ${op[0]}`);
    }
  }
}

export class EncoderImpl implements Encoder {
  readonly #labelsStack = new Stack<Labels>();
  readonly #encoder: InstructionEncoder = new InstructionEncoderImpl([]);
  readonly #errors: EncoderError[] = [];
  readonly #handle: number;

  #heap: CompileTimeHeap;
  #meta: ContainingMetadata;
  #stdlib: STDLibrary | undefined;

  constructor(heap: CompileTimeHeap, meta: ContainingMetadata, stdlib?: STDLibrary | undefined) {
    this.#heap = heap;
    this.#meta = meta;
    this.#stdlib = stdlib;
    this.#handle = heap.malloc();
  }

  error(error: EncoderError): void {
    this.#encoder.encode(PRIMITIVE_OP, 0);
    this.#errors.push(error);
  }

  commit(size: number): HandleResult {
    let handle = this.#handle;

    this.#heap.pushMachine(RETURN_OP);
    this.#heap.finishMalloc(handle, size);

    return isPresentArray(this.#errors) ? { errors: this.#errors, handle } : handle;
  }

  push(
    constants: CompileTimeConstants,
    type: BuilderOpcode,
    ...operands: SingleBuilderOperand[]
  ): void {
    let heap = this.#heap;

    if (import.meta.env.DEV && (type as number) > TYPE_SIZE) {
      throw new Error(`Opcode type over 8-bits. Got ${type}.`);
    }

    let machine = isMachineOp(type) ? MACHINE_MASK : 0;
    let first = type | machine | (operands.length << ARG_SHIFT);

    heap.pushRaw(first);

    for (const op of operands) {
      heap.pushRaw(this.#operand(constants, op));
    }
  }

  #operand(constants: CompileTimeConstants, operand: SingleBuilderOperand): Operand {
    if (typeof operand === 'number') {
      return operand;
    }

    if (typeof operand === 'object' && operand !== null) {
      if (Array.isArray(operand)) {
        return encodeHandle(constants.array(operand));
      } else {
        switch (operand.type) {
          case LABEL_OPERAND:
            this.#currentLabels.target(this.#heap.offset, operand.value);
            return -1;

          case IS_STRICT_MODE_OPERAND:
            return encodeHandle(constants.value(this.#meta.isStrictMode));

          case DEBUG_SYMBOLS_OPERAND:
            return encodeHandle(constants.array(this.#meta.evalSymbols || EMPTY_STRING_ARRAY));

          case BLOCK_OPERAND:
            return encodeHandle(constants.value(compilableBlock(operand.value, this.#meta)));

          case STD_LIB_OPERAND:
            return expect(
              this.#stdlib,
              'attempted to encode a stdlib operand, but the encoder did not have a stdlib. Are you currently building the stdlib?'
            )[operand.value];

          case NON_SMALL_INT_OPERAND:
          case SYMBOL_TABLE_OPERAND:
          case LAYOUT_OPERAND:
            return constants.value(operand.value);
        }
      }
    }

    return encodeHandle(constants.value(operand));
  }

  get #currentLabels(): Labels {
    return expect(this.#labelsStack.current, 'bug: not in a label stack');
  }

  label(name: string) {
    this.#currentLabels.label(name, this.#heap.offset + 1);
  }

  startLabels() {
    this.#labelsStack.push(new Labels());
  }

  stopLabels() {
    let label = expect(this.#labelsStack.pop(), 'unbalanced push and pop labels');
    label.patch(this.#heap);
  }
}

function isBuilderOpcode(op: number): op is BuilderOpcode {
  return op < START_OP;
}
