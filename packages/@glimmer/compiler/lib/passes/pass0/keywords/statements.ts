import { ASTv2, GlimmerSyntaxError } from '@glimmer/syntax';
import { isPresent } from '@glimmer/util';
import { Ok, Result } from '../../../shared/result';
import * as pass1 from '../../pass1/hir';
import { VisitorContext } from '../context';
import { keyword, KeywordNode, keywords } from './impl';

const builders = ASTv2.builders;

export const YIELD = keyword('yield', {
  assert(
    statement: ASTv2.MustacheStatement
  ): {
    target: ASTv2.Literal<'string'>;
    params: ASTv2.Expression[];
    kw: ASTv2.Expression;
  } {
    let { pairs } = statement.hash;
    let { params, path: kw } = statement;

    if (isPresent(pairs)) {
      let first = pairs[0];

      if (first.key !== 'to' || pairs.length > 1) {
        throw new GlimmerSyntaxError(`yield only takes a single named argument: 'to'`, first.loc);
      }

      let target = first.value;

      if (!ASTv2.isLiteral(target, 'string')) {
        throw new GlimmerSyntaxError(`you can only yield to a literal string value`, target.loc);
      }

      return { target, params, kw };
    } else {
      return { target: builders.literal('default'), params, kw };
    }
  },

  translate(
    statement: KeywordNode<ASTv2.MustacheStatement>,
    { utils }: VisitorContext,
    {
      target,
      params: astParams,
      kw,
    }: {
      target: ASTv2.Literal<'string'>;
      params: ASTv2.Expression[];
      kw: ASTv2.Expression;
    }
  ): Result<pass1.Statement> {
    let params = utils.params({ path: kw, params: astParams });
    return Ok(
      utils
        .op(pass1.Yield, {
          target: utils.slice(target.value).loc(target),
          params,
        })
        .loc(statement)
    );
  },
});

export const PARTIAL = keyword('partial', {
  assert(statement: ASTv2.MustacheStatement): ASTv2.Expression | undefined {
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
    statement: KeywordNode<ASTv2.MustacheStatement>,
    ctx: VisitorContext,
    expr: ASTv2.Expression | undefined
  ): Result<pass1.Statement> {
    return Ok(
      ctx.utils
        .op(pass1.Partial, {
          table: statement.symbols,
          expr:
            expr === undefined
              ? ctx.utils.visitExpr(builders.literal(undefined))
              : ctx.utils.visitExpr(expr),
        })
        .loc(statement)
    );
  },
});

export const DEBUGGER = keyword('debugger', {
  assert(statement: ASTv2.MustacheStatement): void {
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

  translate(
    statement: KeywordNode<ASTv2.MustacheStatement>,
    { utils }: VisitorContext
  ): Result<pass1.Statement> {
    return Ok(utils.op(pass1.Debugger, { table: statement.symbols }).loc(statement));
  },
});

export const STATEMENT_KEYWORDS = keywords().add(YIELD).add(PARTIAL).add(DEBUGGER);
