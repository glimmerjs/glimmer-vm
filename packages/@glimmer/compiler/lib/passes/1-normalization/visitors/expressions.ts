import { ASTv2 } from '@glimmer/syntax';
import { assign } from '@glimmer/util';
import { PresentList } from '../../../shared/list';
import * as pass1 from '../../2-symbol-allocation/hir';
import { VisitorContext } from '../context';
import { EXPR_KEYWORDS } from '../keywords';
import { buildPath } from '../utils/builders';
import { assertIsValidHelper, hasPath } from '../utils/is-node';

export type ExpressionOut = pass1.Expr;

/**
 * Convert AST Expressions into normalized expressions.
 *
 * This means:
 *
 * 1. Convert all of the different kinds of literals into pass1.Literal
 * 2. Process the head part of ASTv2.PathExpression into one of:
 *   a. `this`
 *   b. `@arg`
 *   c. free variable (with context in loose mode)
 * 3. Process subexpressions that are keywords (`(has-block)` and `(has-block-params)`)
 * 4. In loose mode, reject paths at the head of sub-expressions (`(x.y)` or `(x.y ...)`)
 */
export class Pass0Expressions {
  visit(node: ASTv2.InternalExpression, ctx: VisitorContext): pass1.Expr {
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

  Literal(literal: ASTv2.Literal, { utils }: VisitorContext): pass1.Literal {
    return utils.op(pass1.Literal, { value: literal.value }).loc(literal);
  }

  Interpolate(expr: ASTv2.Interpolate, ctx: VisitorContext): pass1.Interpolate {
    return ctx.utils
      .op(pass1.Interpolate, {
        parts: new PresentList(expr.parts).map((e) => VISIT_EXPRS.visit(e, ctx)),
      })
      .loc(expr);
  }

  SubExpression(expr: ASTv2.SubExpression, ctx: VisitorContext): pass1.Expr {
    let { utils } = ctx;

    if (!hasPath(expr)) {
      throw new Error(`unimplemented subexpression at the head of a subexpression`);
    } else {
      assertIsValidHelper(expr, expr.loc, 'helper');

      return ctx.utils
        .op(
          pass1.SubExpression,
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

export const VISIT_EXPRS = new Pass0Expressions();

export function isExpr(
  node: ASTv2.Node | { type: keyof Pass0Expressions }
): node is { type: keyof Pass0Expressions } {
  return node.type in VISIT_EXPRS;
}
