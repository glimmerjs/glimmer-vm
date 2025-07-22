import {
  VM_CLOSE_ELEMENT_OP,
  VM_DUP_FP_OP,
  VM_DYNAMIC_MODIFIER_OP,
  VM_FLUSH_ELEMENT_OP,
  VM_POP_FRAME_OP,
  VM_PUSH_ARGS_OP,
  VM_PUSH_EMPTY_ARGS_OP,
  VM_PUSH_FRAME_OP,
} from '@glimmer/constants';
import { EMPTY_STRING_ARRAY } from '@glimmer/util';

import type { EncodeOp } from '../opcode-builder/encoder';

export const CloseElement = (encode: EncodeOp): void => encode.op(VM_CLOSE_ELEMENT_OP);
export const FlushElement = (encode: EncodeOp): void => encode.op(VM_FLUSH_ELEMENT_OP);

export const LexicalModifier = (encode: EncodeOp, expr: () => void, args: () => void): void => {
  expr();
  encode.op(VM_PUSH_FRAME_OP);
  args();
  encode.op(VM_DUP_FP_OP, 1);
  encode.op(VM_DYNAMIC_MODIFIER_OP);
  encode.op(VM_POP_FRAME_OP);
};

/**
 * A call with no arguments.
 */

export const EmptyArgs = (encode: EncodeOp): void => encode.op(VM_PUSH_EMPTY_ARGS_OP);
/**
 * A call with at least one positional or named argument. This function is called after positional
 * and named arguments have been compiled. Positional arguments should be compiled first, left to
 * right, followed by named arguments, in the order that `named` is provided, left to right.
 */

export const CallArgs = (encode: EncodeOp, positional: number, named?: string[]): void =>
  encode.op(
    VM_PUSH_ARGS_OP,
    encode.array(named ?? EMPTY_STRING_ARRAY),
    encode.array(EMPTY_STRING_ARRAY),
    positional << 4
  );
/**
 * A call with at least one positional or named argument. Names are passed as an array *including*
 * the `@` prefix.
 *
 * This function is called after positional and named arguments have been compiled, in the same
 * way as `CallArgs`.
 *
 * @todo there's only one remaining use of this, and it can probably be removed by removing the
 * `@` prefix at the source.
 */

export const CallArgsWithAtNames = (encode: EncodeOp, positional: number, named?: string[]): void =>
  encode.op(
    VM_PUSH_ARGS_OP,
    encode.array(named ?? EMPTY_STRING_ARRAY),
    encode.array(EMPTY_STRING_ARRAY),
    (positional << 4) | 0b1000
  );
