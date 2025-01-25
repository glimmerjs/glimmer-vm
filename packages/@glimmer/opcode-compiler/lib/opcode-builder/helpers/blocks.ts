import type { Nullable, Optional, WireFormat } from '@glimmer/interfaces';
import {
  VM_CHILD_SCOPE_OP,
  VM_COMPILE_BLOCK_OP,
  VM_CONSTANT_OP,
  VM_DUP_OP,
  VM_GET_BLOCK_OP,
  VM_INVOKE_VIRTUAL_OP,
  VM_INVOKE_YIELD_OP,
  VM_POP_FRAME_OP,
  VM_POP_SCOPE_OP,
  VM_PUSH_BLOCK_SCOPE_OP,
  VM_PUSH_FRAME_OP,
  VM_PUSH_SYMBOL_TABLE_OP,
  VM_SET_VARIABLE_OP,
  VM_SPREAD_BLOCK_OP,
} from '@glimmer/constants';
import { $fp } from '@glimmer/vm';

import type { EncodeOp } from '../encoder';

import { SimpleArgs } from './shared';
import { PushPrimitive } from './vm';

/**
 * Yield to a block located at a particular symbol location.
 *
 * @param to the symbol containing the block to yield to
 * @param params optional block parameters to yield to the block
 */
export function YieldBlock(
  encode: EncodeOp,
  to: number,
  positional?: Optional<WireFormat.Core.Params>
): void {
  SimpleArgs(encode, positional && { params: positional }, true);
  encode.op(VM_GET_BLOCK_OP, to);
  encode.op(VM_SPREAD_BLOCK_OP);
  encode.op(VM_COMPILE_BLOCK_OP);
  encode.op(VM_INVOKE_YIELD_OP);
  encode.op(VM_POP_SCOPE_OP);
  encode.op(VM_POP_FRAME_OP);
}

/**
 * Push an (optional) yieldable block onto the stack. The yieldable block must be known
 * statically at compile time.
 *
 * @param block An optional Compilable block
 */
export function PushYieldableBlock(
  encode: EncodeOp,
  block: Nullable<WireFormat.SerializedInlineBlock>
): void {
  PushSymbolTable(encode, block && block[1]);
  encode.op(VM_PUSH_BLOCK_SCOPE_OP);
  PushCompilable(encode, block);
}

/**
 * Invoke a block that is known statically at compile time.
 *
 * @param block a Compilable block
 */
export function InvokeStaticBlock(encode: EncodeOp, block: WireFormat.SerializedInlineBlock): void {
  encode.op(VM_PUSH_FRAME_OP);
  PushCompilable(encode, block);
  encode.op(VM_COMPILE_BLOCK_OP);
  encode.op(VM_INVOKE_VIRTUAL_OP);
  encode.op(VM_POP_FRAME_OP);
}

/**
 * Invoke a static block, preserving some number of stack entries for use in
 * updating.
 *
 * @param block A compilable block
 * @param callerCount A number of stack entries to preserve
 */
export function InvokeStaticBlockWithStack(
  encode: EncodeOp,
  block: WireFormat.SerializedInlineBlock,
  callerCount: number
): void {
  let parameters = block[1];
  let calleeCount = parameters.length;
  let count = Math.min(callerCount, calleeCount);

  if (count === 0) {
    InvokeStaticBlock(encode, block);
    return;
  }

  encode.op(VM_PUSH_FRAME_OP);

  if (count) {
    encode.op(VM_CHILD_SCOPE_OP);

    for (let i = 0; i < count; i++) {
      encode.op(VM_DUP_OP, $fp, callerCount - i);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
      encode.op(VM_SET_VARIABLE_OP, parameters[i]!);
    }
  }

  PushCompilable(encode, block);
  encode.op(VM_COMPILE_BLOCK_OP);
  encode.op(VM_INVOKE_VIRTUAL_OP);

  if (count) {
    encode.op(VM_POP_SCOPE_OP);
  }

  encode.op(VM_POP_FRAME_OP);
}

export function PushSymbolTable(encode: EncodeOp, parameters: number[] | null): void {
  if (parameters !== null) {
    encode.op(VM_PUSH_SYMBOL_TABLE_OP, encode.constant({ parameters }));
  } else {
    PushPrimitive(encode, null);
  }
}

export function PushCompilable(
  encode: EncodeOp,
  _block: Nullable<WireFormat.SerializedInlineBlock>
): void {
  if (_block === null) {
    PushPrimitive(encode, null);
  } else {
    encode.op(VM_CONSTANT_OP, encode.block(_block));
  }
}
