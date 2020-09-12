import { ASTv2 } from '@glimmer/syntax';
import { assign } from '@glimmer/util';
import { PresentList } from '../../../shared/list';
import * as pass1 from '../../pass1/hir';
import { InfallibleVisitorInterface, NormalizationUtilities, VisitorContext } from '../context';
import { EXPR_KEYWORDS } from '../keywords';
import { buildPath } from '../utils/builders';
import { assertIsSimpleHelper, hasPath } from '../utils/is-node';

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
 *   c. free variable (with context in sloppy mode)
 * 3. Process subexpressions that are keywords (`(has-block)` and `(has-block-params)`)
 * 4. In sloppy mode, reject paths at the head of sub-expressions (`(x.y)` or `(x.y ...)`)
 */
export class Pass0Expressions
  implements InfallibleVisitorInterface<ASTv2.Expression, ExpressionOut> {
  visit<K extends keyof Pass0Expressions & keyof ASTv2.Nodes>(
    node: ASTv2.Node & { type: K },
    ctx: VisitorContext
  ): ReturnType<Pass0Expressions[K]> {
    let f = this[node.type] as (
      node: ASTv2.Node & { type: K },
      ctx: VisitorContext
    ) => ExpressionOut;
    return f(node, ctx) as ReturnType<Pass0Expressions[K]>;
  }

  PathExpression(path: ASTv2.PathExpression, { utils }: VisitorContext): ExpressionOut {
    return buildPath(utils, path);
  }

  Literal(literal: ASTv2.Literal, { utils }: VisitorContext): pass1.Literal {
    return utils.op(pass1.Literal, { value: literal.value }).loc(literal);
  }

  Interpolate(expr: ASTv2.Interpolate, { utils }: VisitorContext): pass1.Interpolate {
    return utils
      .op(pass1.Interpolate, {
        parts: new PresentList(expr.parts).map((e) => utils.visitExpr(e)),
      })
      .loc(expr);
  }

  interpolatePart(expr: ASTv2.Expression, utils: NormalizationUtilities): pass1.Expr {
    if (expr.type === 'PathExpression') {
      if (EXPR_KEYWORDS.match(expr)) {
      }
    } else {
      return utils.visitExpr(expr);
    }
  }

  SubExpression(expr: ASTv2.SubExpression, ctx: VisitorContext): pass1.Expr {
    let { utils } = ctx;

    if (EXPR_KEYWORDS.match(expr)) {
      return EXPR_KEYWORDS.translate(expr, ctx).expect();
    } else if (!hasPath(expr)) {
      throw new Error(`unimplemented subexpression at the head of a subexpression`);
    } else {
      assertIsSimpleHelper(expr, expr.loc, 'helper');

      return ctx.utils
        .op(
          pass1.SubExpression,
          assign(
            {
              head: ctx.utils.visitExpr(expr.path),
            },
            utils.args(expr)
          )
        )
        .loc(expr);
    }
  }
}

export const EXPRESSIONS = new Pass0Expressions();

export function isExpr(
  node: ASTv2.Node | { type: keyof Pass0Expressions }
): node is { type: keyof Pass0Expressions } {
  return node.type in EXPRESSIONS;
}
