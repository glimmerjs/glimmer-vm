import type { WireFormat } from '@glimmer/interfaces';

import type { PushExpressionOp } from '../../syntax/compiler-impl';
import { PushPrimitive } from './vm';
import { PRIMITIVE_REFERENCE_OP } from '@glimmer/vm-constants';
import { compileExpr } from '../../syntax/compilers';

export function expr(op: PushExpressionOp, expression: WireFormat.Expression): void {
  if (Array.isArray(expression)) {
    compileExpr(op, expression);
  } else {
    PushPrimitive(op, expression);
    op(PRIMITIVE_REFERENCE_OP);
  }
}
