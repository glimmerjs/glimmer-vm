import { ASTv2 } from '@glimmer/syntax';
import { assert } from '@glimmer/util';
import { OptionalList, PresentList } from '../../../../shared/list';
import * as pass1 from '../../../2-symbol-allocation/hir';
import { VisitorContext } from '../../context';

// function simpleDynamicAttrValue(
//   ctx: VisitorContext,
//   value: ASTv2.MustacheStatement | ASTv2.TextNode
// ): pass1.Expr {
//   let { utils } = ctx;

//   // returns the static value if the value is static
//   if (value.type === 'TextNode') {
//     return utils.op(pass1.Literal, { value: value.chars }).loc(value);
//   }

//   if (EXPR_KEYWORDS.match(value)) {
//     return EXPR_KEYWORDS.translate(value, ctx).expect();
//   }

//   if (isHelperInvocation(value)) {
//     assertIsSimpleHelper(value, value.loc, 'helper');

//     return utils
//       .op(
//         pass1.SubExpression,
//         assign(
//           {
//             head: ctx.utils.visitExpr(value.path, ExpressionContext.CallHead),
//           },
//           utils.args(value)
//         )
//       )
//       .loc(value);
//   }

//   switch (value.path.type) {
//     case 'PathExpression': {
//       if (isSimplePath(value.path)) {
//         // x={{simple}}
//         return buildPathWithContext(utils, value.path, ExpressionContext.AppendSingleId);
//       } else {
//         // x={{simple.value}}

//         return buildPathWithContext(utils, value.path, ExpressionContext.Expression);
//       }
//     }

//     default: {
//       return ctx.utils.visitExpr(value.path);
//     }
//   }
// }

export function dynamicAttrValue(ctx: VisitorContext, value: ASTv2.InternalExpression): pass1.Expr {
  let { utils } = ctx;

  if (value.type === 'Interpolate') {
    let exprs = OptionalList(value.parts.map((part) => ctx.utils.visitExpr(part)));
    assert(exprs instanceof PresentList, `attribute concats must have at least one part`);

    return utils.op(pass1.Interpolate, { parts: exprs }).loc(value);
  }

  return ctx.utils.visitExpr(value);
}
