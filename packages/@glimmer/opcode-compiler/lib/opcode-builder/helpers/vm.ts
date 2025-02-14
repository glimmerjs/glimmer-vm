import type { CurriedType, Nullable, Optional, WireFormat } from '@glimmer/interfaces';
import {
  encodeImmediate,
  isSmallInt,
  VM_CAPTURE_ARGS_OP,
  VM_CURRY_OP,
  VM_DUP_FP_OP,
  VM_DYNAMIC_HELPER_OP,
  VM_FETCH_OP,
  VM_HELPER_OP,
  VM_INVOKE_STATIC_OP,
  VM_POP_FRAME_OP,
  VM_POP_OP,
  VM_PRIMITIVE_OP,
  VM_PRIMITIVE_REFERENCE_OP,
  VM_PUSH_FRAME_OP,
} from '@glimmer/constants';
import { $v0 } from '@glimmer/vm';
import { EMPTY_ARGS_OPCODE } from '@glimmer/wire-format';

import type { EncodeOp } from '../encoder';

import { expr } from './expr';
import { SimpleArgs } from './shared';

export type Primitive = undefined | null | boolean | number | string;

export interface CompileHelper {
  handle: number;
  positional: Nullable<WireFormat.Core.Params>;
  named: WireFormat.Core.Hash;
}

/**
 * Push a reference onto the stack corresponding to a statically known primitive
 * @param value A JavaScript primitive (undefined, null, boolean, number or string)
 */
export function PushPrimitiveReference(encode: EncodeOp, value: Primitive): void {
  PushPrimitive(encode, value);
  encode.op(VM_PRIMITIVE_REFERENCE_OP);
}

/**
 * Push an encoded representation of a JavaScript primitive on the stack
 *
 * @param value A JavaScript primitive (undefined, null, boolean, number or string)
 */
export function PushPrimitive(encode: EncodeOp, primitive: Primitive): void {
  const encoded =
    typeof primitive === 'number' && isSmallInt(primitive)
      ? encodeImmediate(primitive)
      : encode.constant(primitive);

  encode.op(VM_PRIMITIVE_OP, encoded);
}

/**
 * Invoke a foreign function (a "helper") based on a statically known handle
 *
 * @param op The op creation function
 * @param handle A handle
 * @param positional An optional list of expressions to compile
 * @param named An optional list of named arguments (name + expression) to compile
 */
export function Call(encode: EncodeOp, handle: number, args?: WireFormat.Core.CallArgs): void {
  SimpleArgs(encode, args ?? [EMPTY_ARGS_OPCODE]);
  encode.op(VM_HELPER_OP, handle);
  encode.op(VM_FETCH_OP, $v0);
}

export function CallDynamicBlock(
  encode: EncodeOp,
  handle: number,
  args: WireFormat.Core.CallArgs
): void {
  encode.op(VM_PUSH_FRAME_OP);
  SimpleArgs(encode, args);
  encode.op(VM_DUP_FP_OP, 1);
  encode.op(VM_DYNAMIC_HELPER_OP);

  encode.op(VM_FETCH_OP, $v0);
  encode.op(VM_INVOKE_STATIC_OP, handle);

  encode.op(VM_POP_FRAME_OP);
  encode.op(VM_POP_OP, 1);
}

export function Curry(
  encode: EncodeOp,
  type: CurriedType,
  definition: WireFormat.Expression,
  args: Optional<WireFormat.Core.CallArgs>
): void {
  encode.op(VM_PUSH_FRAME_OP);
  SimpleArgs(encode, args ?? [EMPTY_ARGS_OPCODE]);
  encode.op(VM_CAPTURE_ARGS_OP);
  expr(encode, definition);
  encode.op(VM_CURRY_OP, type, encode.isDynamicStringAllowed());
  encode.op(VM_POP_FRAME_OP);
  encode.op(VM_FETCH_OP, $v0);
}
