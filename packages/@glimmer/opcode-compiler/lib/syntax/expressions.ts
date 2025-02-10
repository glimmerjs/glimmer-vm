import type { ExpressionSexpOpcode } from '@glimmer/interfaces';
import { VM_FETCH_OP, VM_LOG_OP, VM_POP_FRAME_OP, VM_PUSH_FRAME_OP } from '@glimmer/constants';
import { $v0 } from '@glimmer/vm';
import { SexpOpcodes as Op } from '@glimmer/wire-format';

import type { EncodeOp } from '../opcode-builder/encoder';

import { SimpleArgs } from '../opcode-builder/helpers/shared';
import { Compilers } from './compilers';

export const EXPRESSIONS = new Compilers<ExpressionSexpOpcode>();

export const Log = (encode: EncodeOp, expr: () => void) => {
  encode.op(VM_PUSH_FRAME_OP);
  expr();
  encode.op(VM_LOG_OP);
  encode.op(VM_POP_FRAME_OP);
  encode.op(VM_FETCH_OP, $v0);
};

EXPRESSIONS.add(Op.Log, (encode, [, positional]) => {
  Log(encode, () => SimpleArgs(encode, positional && { params: positional }, false));
});
