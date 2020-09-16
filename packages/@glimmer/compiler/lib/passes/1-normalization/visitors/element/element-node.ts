import { ASTv2 } from '@glimmer/syntax';
import { assert } from '@glimmer/util';
import { OptionalList, PresentList } from '../../../../shared/list';
import * as pass1 from '../../../2-symbol-allocation/hir';
import { VisitorContext } from '../../context';
import { VISIT_EXPRS } from '../expressions';

export function dynamicAttrValue(ctx: VisitorContext, value: ASTv2.InternalExpression): pass1.Expr {
  let { utils } = ctx;

  if (value.type === 'Interpolate') {
    let exprs = OptionalList(value.parts.map((part) => VISIT_EXPRS.visit(part, ctx)));
    assert(exprs instanceof PresentList, `attribute concats must have at least one part`);

    return utils.op(pass1.Interpolate, { parts: exprs }).loc(value);
  }

  return VISIT_EXPRS.visit(value, ctx);
}
