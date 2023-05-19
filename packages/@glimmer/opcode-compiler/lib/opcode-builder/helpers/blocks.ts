import type { Nullable, WireFormat } from '@glimmer/interfaces';
import {
  $fp,
  CHILD_SCOPE_OP,
  COMPILE_BLOCK_OP,
  CONSTANT_OP,
  DUP_OP,
  GET_BLOCK_OP,
  INVOKE_VIRTUAL_OP,
  INVOKE_YIELD_OP,
  POP_FRAME_OP,
  POP_SCOPE_OP,
  PUSH_BLOCK_SCOPE_OP,
  PUSH_FRAME_OP,
  PUSH_SYMBOL_TABLE_OP,
  SET_VARIABLE_OP,
  SPREAD_BLOCK_OP,
} from '@glimmer/vm-constants';

import type { PushExpressionOp, PushStatementOp } from '../../syntax/compiler-impl';
import { blockOperand, symbolTableOperand } from '../operands';
import { SimpleArguments } from './shared';
import { PushPrimitive } from './vm';

/**
 * Yield to a block located at a particular symbol location.
 *
 * @param to the symbol containing the block to yield to
 * @param params optional block parameters to yield to the block
 */
export function YieldBlock(
  op: PushStatementOp,
  to: number,
  positional: Nullable<WireFormat.Core.Params>
): void {
  SimpleArguments(op, positional, null, true);
  op(GET_BLOCK_OP, to);
  op(SPREAD_BLOCK_OP);
  op(COMPILE_BLOCK_OP);
  op(INVOKE_YIELD_OP);
  op(POP_SCOPE_OP);
  op(POP_FRAME_OP);
}

/**
 * Push an (optional) yieldable block onto the stack. The yieldable block must be known
 * statically at compile time.
 *
 * @param block An optional Compilable block
 */
export function PushYieldableBlock(
  op: PushStatementOp,
  block: Nullable<WireFormat.SerializedInlineBlock>
): void {
  PushSymbolTable(op, block && block[1]);
  op(PUSH_BLOCK_SCOPE_OP);
  PushCompilable(op, block);
}

/**
 * Invoke a block that is known statically at compile time.
 *
 * @param block a Compilable block
 */
export function InvokeStaticBlock(
  op: PushStatementOp,
  block: WireFormat.SerializedInlineBlock
): void {
  op(PUSH_FRAME_OP);
  PushCompilable(op, block);
  op(COMPILE_BLOCK_OP);
  op(INVOKE_VIRTUAL_OP);
  op(POP_FRAME_OP);
}

/**
 * Invoke a static block, preserving some number of stack entries for use in
 * updating.
 *
 * @param block A compilable block
 * @param callerCount A number of stack entries to preserve
 */
export function InvokeStaticBlockWithStack(
  op: PushStatementOp,
  block: WireFormat.SerializedInlineBlock,
  callerCount: number
): void {
  let parameters = block[1];
  let calleeCount = parameters.length;
  let count = Math.min(callerCount, calleeCount);

  if (count === 0) {
    InvokeStaticBlock(op, block);
    return;
  }

  op(PUSH_FRAME_OP);

  if (count) {
    op(CHILD_SCOPE_OP);

    for (let index = 0; index < count; index++) {
      op(DUP_OP, $fp, callerCount - index);
      op(SET_VARIABLE_OP, parameters[index]);
    }
  }

  PushCompilable(op, block);
  op(COMPILE_BLOCK_OP);
  op(INVOKE_VIRTUAL_OP);

  if (count) {
    op(POP_SCOPE_OP);
  }

  op(POP_FRAME_OP);
}

export function PushSymbolTable(op: PushExpressionOp, parameters: number[] | null): void {
  if (parameters === null) {
    PushPrimitive(op, null);
  } else {
    op(PUSH_SYMBOL_TABLE_OP, symbolTableOperand({ parameters }));
  }
}

export function PushCompilable(
  op: PushExpressionOp,
  _block: Nullable<WireFormat.SerializedInlineBlock>
): void {
  if (_block === null) {
    PushPrimitive(op, null);
  } else {
    op(CONSTANT_OP, blockOperand(_block));
  }
}
