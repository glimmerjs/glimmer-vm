import type { WireFormat } from '@glimmer/interfaces';
import { VM_PRIMITIVE_REFERENCE_OP } from '@glimmer/constants';

import type { BuildExpression } from '../../syntax/compilers';

import { EXPRESSIONS } from '../../syntax/expressions';
import { PushPrimitive } from './vm';
import type { EncodeOp } from '../encoder';

export function expr(encode: EncodeOp, expression: WireFormat.Expression): void {
  if (Array.isArray(expression)) {
    EXPRESSIONS.compile(encode, expression);
  } else {
    PushPrimitive(encode, expression);
    encode.op(VM_PRIMITIVE_REFERENCE_OP);
  }
}
