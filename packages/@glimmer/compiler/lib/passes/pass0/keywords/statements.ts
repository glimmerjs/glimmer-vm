import { ExpressionContext } from '@glimmer/interfaces';
import { AST, builders, GlimmerSyntaxError } from '@glimmer/syntax';
import { isPresent } from '@glimmer/util';
import * as pass1 from '../../pass1/ops';
import { Ok, Result } from '../../shared/result';
import { Context } from '../context';
import { buildParams } from '../utils/builders';
import { keyword, KeywordNode, keywords } from './impl';

export const YIELD = keyword('yield', {
  assert(
    statement: AST.MustacheStatement
  ): {
    target: AST.StringLiteral;
    params: AST.Expression[];
    kw: AST.Expression;
  } {
    let { pairs } = statement.hash;
    let { params, path: kw } = statement;

    if (isPresent(pairs)) {
      let first = pairs[0];

      if (first.key !== 'to' || pairs.length > 1) {
        throw new GlimmerSyntaxError(`yield only takes a single named argument: 'to'`, first.loc);
      }

      let target = first.value;

      if (target.type !== 'StringLiteral') {
        throw new GlimmerSyntaxError(`you can only yield to a literal value`, target.loc);
      }

      return { target, params, kw };
    } else {
      return { target: builders.string('default'), params, kw };
    }
  },

  translate(
    statement: KeywordNode<AST.MustacheStatement>,
    ctx: Context,
    {
      target,
      params: astParams,
      kw,
    }: {
      target: AST.StringLiteral;
      params: AST.Expression[];
      kw: AST.Expression;
    }
  ): Result<pass1.Statement> {
    let params = buildParams(ctx, { path: kw, params: astParams });
    return Ok(
      ctx
        .op(pass1.Yield, {
          target: ctx.slice(target.value).loc(target),
          params,
        })
        .loc(statement)
    );
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
      throw new GlimmerSyntaxError(
        `Partial found with no arguments. You must specify a template name. (on line ${loc.start.line})`,
        statement.loc
      );
    }

    if (hasParams && params.length !== 1) {
      throw new GlimmerSyntaxError(
        `Partial found with ${params.length} arguments. You must specify a template name. (on line ${loc.start.line})`,
        statement.loc
      );
    }

    if (isPresent(pairs)) {
      throw new GlimmerSyntaxError(
        `Partial does not take any named arguments (on line ${loc.start.line})`,
        statement.loc
      );
    }

    if (!escaped) {
      throw new GlimmerSyntaxError(
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
  ): Result<pass1.Statement> {
    return Ok(
      ctx
        .op(pass1.Partial, {
          expr:
            expr === undefined
              ? ctx.visitExpr(builders.undefined(), ExpressionContext.Expression)
              : ctx.visitExpr(expr, ExpressionContext.Expression),
        })
        .loc(statement)
    );
  },
});

export const DEBUGGER = keyword('debugger', {
  assert(statement: AST.MustacheStatement): void {
    let {
      params,
      hash: { pairs },
    } = statement;

    if (isPresent(pairs)) {
      throw new GlimmerSyntaxError(`debugger does not take any named arguments`, statement.loc);
    }

    if (isPresent(params)) {
      throw new GlimmerSyntaxError(
        `debugger does not take any positional arguments`,
        statement.loc
      );
    }
  },

  translate(statement: KeywordNode<AST.MustacheStatement>, ctx: Context): Result<pass1.Statement> {
    return Ok(ctx.op(pass1.Debugger).loc(statement));
  },
});

export const STATEMENT_KEYWORDS = keywords().add(YIELD).add(PARTIAL).add(DEBUGGER);
