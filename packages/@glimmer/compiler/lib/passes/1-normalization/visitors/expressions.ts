import { ASTv2 } from '@glimmer/syntax';
import { assign } from '@glimmer/util';
import { PresentList } from '../../../shared/list';
import * as hir from '../../2-symbol-allocation/hir';
import { VisitorContext } from '../context';
import { EXPR_KEYWORDS } from '../keywords';
import { buildPath } from '../utils/builders';
import { assertIsValidHelper, hasPath } from '../utils/is-node';

export type ExpressionOut = hir.Expr;

export class NormalizeExpressions {
  visit(node: ASTv2.InternalExpression, ctx: VisitorContext): hir.Expr {
    if (EXPR_KEYWORDS.match(node)) {
      return EXPR_KEYWORDS.translate(node, ctx).expect('TODO');
    }

    switch (node.type) {
      case 'Literal':
        return this.Literal(node, ctx);
      case 'PathExpression':
        return this.PathExpression(node, ctx);
      case 'SubExpression':
        return this.SubExpression(node, ctx);
      case 'Interpolate':
        return this.Interpolate(node, ctx);
    }
  }

  PathExpression(path: ASTv2.PathExpression, ctx: VisitorContext): ExpressionOut {
    return buildPath(ctx, path).expect('TODO');
  }

  Literal(literal: ASTv2.Literal, { utils }: VisitorContext): hir.Literal {
    return utils.op(hir.Literal, { value: literal.value }).loc(literal);
  }

  Interpolate(expr: ASTv2.Interpolate, ctx: VisitorContext): hir.Interpolate {
    return ctx.utils
      .op(hir.Interpolate, {
        parts: new PresentList(expr.parts).map((e) => VISIT_EXPRS.visit(e, ctx)),
      })
      .loc(expr);
  }

  SubExpression(expr: ASTv2.SubExpression, ctx: VisitorContext): hir.Expr {
    let { utils } = ctx;

    if (!hasPath(expr)) {
      throw new Error(`unimplemented subexpression at the head of a subexpression`);
    } else {
      assertIsValidHelper(expr, expr.loc, 'helper');

      return ctx.utils
        .op(
          hir.SubExpression,
          assign(
            {
              head: VISIT_EXPRS.visit(expr.func, ctx),
            },
            utils.args(expr)
          )
        )
        .loc(expr);
    }
  }
}

export const VISIT_EXPRS = new NormalizeExpressions();

export function isExpr(
  node: ASTv2.Node | { type: keyof NormalizeExpressions }
): node is { type: keyof NormalizeExpressions } {
  return node.type in VISIT_EXPRS;
}
