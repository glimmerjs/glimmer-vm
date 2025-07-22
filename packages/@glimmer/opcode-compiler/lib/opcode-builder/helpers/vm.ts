import type { Nullable, WireFormat } from '@glimmer/interfaces';
import {
  encodeImmediate,
  isSmallInt,
  VM_HELPER_OP,
  VM_POP_FRAME_OP,
  VM_PRIMITIVE_OP,
  VM_PRIMITIVE_REFERENCE_OP,
  VM_PUSH_FRAME_WITH_RESERVED_OP,
} from '@glimmer/constants';
import { EMPTY_ARGS_OPCODE } from '@glimmer/wire-format';

import type { EncodeOp } from '../encoder';

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
  encode.op(VM_PUSH_FRAME_WITH_RESERVED_OP);
  SimpleArgs(encode, args ?? [EMPTY_ARGS_OPCODE]);
  encode.op(VM_HELPER_OP, handle);
  encode.op(VM_POP_FRAME_OP);
}
