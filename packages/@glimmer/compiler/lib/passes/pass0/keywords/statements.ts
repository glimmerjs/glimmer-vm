import { ExpressionContext, Option } from '@glimmer/interfaces';
import { AST, builders, SyntaxError } from '@glimmer/syntax';
import { isPresent, mapPresent, PresentArray, toPresentOption } from '@glimmer/util';
import * as pass1 from '../../pass1/ops';
import { Context } from '../context';
import { keyword, KeywordNode, keywords } from './impl';

export const YIELD = keyword('yield', {
  assert(
    statement: AST.MustacheStatement
  ): { target: AST.StringLiteral; params: Option<PresentArray<AST.Expression>> } {
    let { pairs } = statement.hash;
    let params = toPresentOption(statement.params);

    if (isPresent(pairs)) {
      let first = pairs[0];

      if (first.key !== 'to' || pairs.length > 1) {
        throw new SyntaxError(`yield only takes a single named argument: 'to'`, first.loc);
      }

      let target = first.value;

      if (target.type !== 'StringLiteral') {
        throw new SyntaxError(`you can only yield to a literal value`, target.loc);
      }

      return { target, params };
    } else {
      return { target: builders.string('default'), params };
    }
  },

  translate(
    statement: KeywordNode<AST.MustacheStatement>,
    ctx: Context,
    {
      target,
      params: astParams,
    }: { target: AST.StringLiteral; params: Option<PresentArray<AST.Expression>> }
  ): pass1.Statement {
    let params = mapPresent(astParams, (expr) => ctx.visitExpr(expr));
    return ctx
      .op(pass1.Yield, {
        target: ctx.slice(target.value).loc(target),
        params: ctx.expr(pass1.Params, { list: params }).loc(astParams),
      })
      .loc(statement);
  },
});

export const PARTIAL = keyword('partial', {
  assert(statement: AST.MustacheStatement): AST.Expression | undefined {
    let {
      params,
      hash: { pairs },
      escaped,
      loc,
    } = statement;

    let hasParams = isPresent(params);

    if (!hasParams) {
      throw new SyntaxError(
        `Partial found with no arguments. You must specify a template name. (on line ${loc.start.line})`,
        statement.loc
      );
    }

    if (hasParams && params.length !== 1) {
      throw new SyntaxError(
        `Partial found with ${params.length} arguments. You must specify a template name. (on line ${loc.start.line})`,
        statement.loc
      );
    }

    if (isPresent(pairs)) {
      throw new SyntaxError(
        `Partial does not take any named arguments (on line ${loc.start.line})`,
        statement.loc
      );
    }

    if (!escaped) {
      throw new SyntaxError(
        `{{{partial ...}}} is not supported, please use {{partial ...}} instead (on line ${loc.start.line})`,
        statement.loc
      );
    }

    return params[0];
  },

  translate(
    statement: KeywordNode<AST.MustacheStatement>,
    ctx: Context,
    expr: AST.Expression | undefined
  ): pass1.Statement {
    return ctx
      .op(pass1.Partial, {
        expr:
          expr === undefined
            ? ctx.visitExpr(builders.undefined(), ExpressionContext.Expression)
            : ctx.visitExpr(expr, ExpressionContext.Expression),
      })
      .loc(statement);
  },
});

export const DEBUGGER = keyword('debugger', {
  assert(statement: AST.MustacheStatement): void {
    let {
      params,
      hash: { pairs },
    } = statement;

    if (isPresent(pairs)) {
      throw new SyntaxError(`debugger does not take any named arguments`, statement.loc);
    }

    if (isPresent(params)) {
      throw new SyntaxError(`debugger does not take any positional arguments`, statement.loc);
    }
  },

  translate(statement: KeywordNode<AST.MustacheStatement>, ctx: Context): pass1.Statement {
    return ctx.op(pass1.Debugger).loc(statement);
  },
});

export const STATEMENT_KEYWORDS = keywords().add(YIELD).add(PARTIAL).add(DEBUGGER);
