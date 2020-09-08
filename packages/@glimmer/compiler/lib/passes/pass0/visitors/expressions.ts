import { ExpressionContext } from '@glimmer/interfaces';
import { AST } from '@glimmer/syntax';
import { assign } from '@glimmer/util';
import * as pass1 from '../../pass1/ops';
import { Context, VisitorInterface } from '../context';
import { EXPR_KEYWORDS } from '../keywords';
import { buildArgs, buildPathWithContext } from '../utils/builders';
import { assertIsSimpleHelper, hasPath } from '../utils/is-node';

/**
 * Convert AST Expressions into normalized expressions.
 *
 * This means:
 *
 * 1. Convert all of the different kinds of literals into pass1.Literal
 * 2. Process the head part of AST.PathExpression into one of:
 *   a. `this`
 *   b. `@arg`
 *   c. free variable (with context in sloppy mode)
 * 3. Process subexpressions that are keywords (`(has-block)` and `(has-block-params)`)
 * 4. In sloppy mode, reject paths at the head of sub-expressions (`(x.y)` or `(x.y ...)`)
 */
export class Pass0Expressions implements VisitorInterface<AST.Expression, pass1.Expr> {
  PathExpression(path: AST.PathExpression, ctx: Context): pass1.Expr {
    return buildPathWithContext(ctx, path, ExpressionContext.Expression);
  }

  StringLiteral(literal: AST.StringLiteral, ctx: Context): pass1.Literal {
    return ctx.op(pass1.Literal, literal).loc(literal);
  }

  BooleanLiteral(literal: AST.BooleanLiteral, ctx: Context): pass1.Literal {
    return ctx.op(pass1.Literal, literal).loc(literal);
  }

  NumberLiteral(literal: AST.NumberLiteral, ctx: Context): pass1.Literal {
    return ctx.op(pass1.Literal, literal).loc(literal);
  }

  NullLiteral(literal: AST.NullLiteral, ctx: Context): pass1.Literal {
    return ctx.op(pass1.Literal, literal).loc(literal);
  }

  UndefinedLiteral(literal: AST.UndefinedLiteral, ctx: Context): pass1.Literal {
    return ctx.op(pass1.Literal, literal).loc(literal);
  }

  SubExpression(expr: AST.SubExpression, ctx: Context): pass1.Expr {
    if (EXPR_KEYWORDS.match(expr)) {
      return EXPR_KEYWORDS.translate(expr, ctx).expect();
    } else if (!hasPath(expr)) {
      throw new Error(`unimplemented subexpression at the head of a subexpression`);
    } else {
      assertIsSimpleHelper(expr, expr.loc, 'helper');

      return ctx
        .op(
          pass1.SubExpression,
          assign(
            {
              head: ctx.visitExpr(expr.path, ExpressionContext.CallHead),
            },
            buildArgs(ctx, expr)
          )
        )
        .loc(expr);
    }
  }
}

export const EXPRESSIONS = new Pass0Expressions();
