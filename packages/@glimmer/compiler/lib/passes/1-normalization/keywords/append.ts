import { ASTv2, GlimmerSyntaxError } from '@glimmer/syntax';
import { isPresent } from '@glimmer/util';
import { Ok, Result } from '../../../shared/result';
import { Source } from '../../../source/source';
import * as pass1 from '../../2-symbol-allocation/hir';
import { VisitorContext } from '../context';
import { assertValidHasBlockUsage } from './has-block';
import { keywords, Match } from './impl';

const builders = ASTv2.builders;

export const APPEND_KEYWORDS = keywords('Append')
  .kw('yield', {
    assert(
      node: ASTv2.AppendStatement
    ): {
      target: ASTv2.Literal<'string'>;
      params: ASTv2.InternalExpression[];
      kw: ASTv2.InternalExpression;
    } {
      let { func: kw, params, pairs } = extract(node);

      // let { pairs } = node.hash;
      // let { params, func: kw } = node;

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
      node: ASTv2.AppendStatement,
      { utils }: VisitorContext,
      {
        target,
        params: astParams,
        kw,
      }: {
        target: ASTv2.Literal<'string'>;
        params: ASTv2.InternalExpression[];
        kw: ASTv2.Expression;
      }
    ): Result<pass1.Statement> {
      let params = utils.params({ func: kw, params: astParams });
      return Ok(
        utils
          .op(pass1.Yield, {
            target: utils.slice(target.value).loc(target),
            params,
          })
          .loc(node)
      );
    },
  })
  .kw('partial', {
    assert(node: ASTv2.AppendStatement): ASTv2.InternalExpression | undefined {
      let { params, pairs } = extract(node);
      let { trusting, loc } = node;

      let hasParams = isPresent(params);

      if (!hasParams) {
        throw new GlimmerSyntaxError(
          `Partial found with no arguments. You must specify a template name. (on line ${loc.start.line})`,
          node.loc
        );
      }

      if (hasParams && params.length !== 1) {
        throw new GlimmerSyntaxError(
          `Partial found with ${params.length} arguments. You must specify a template name. (on line ${loc.start.line})`,
          node.loc
        );
      }

      if (isPresent(pairs)) {
        throw new GlimmerSyntaxError(
          `Partial does not take any named arguments (on line ${loc.start.line})`,
          node.loc
        );
      }

      if (trusting) {
        throw new GlimmerSyntaxError(
          `{{{partial ...}}} is not supported, please use {{partial ...}} instead (on line ${loc.start.line})`,
          node.loc
        );
      }

      return params[0];
    },

    translate(
      node: ASTv2.AppendStatement,
      ctx: VisitorContext,
      expr: ASTv2.InternalExpression | undefined
    ): Result<pass1.Statement> {
      return Ok(
        ctx.utils
          .op(pass1.Partial, {
            table: node.table,
            expr:
              expr === undefined
                ? ctx.utils.visitExpr(builders.literal(undefined))
                : ctx.utils.visitExpr(expr),
          })
          .loc(node)
      );
    },
  })
  .kw('debugger', {
    assert(node: ASTv2.AppendStatement): void {
      let { params, pairs } = extract(node);

      if (isPresent(pairs)) {
        throw new GlimmerSyntaxError(`debugger does not take any named arguments`, node.loc);
      }

      if (isPresent(params)) {
        throw new GlimmerSyntaxError(`debugger does not take any positional arguments`, node.loc);
      }
    },

    translate(node: Match<'Append'>, { utils }: VisitorContext): Result<pass1.Statement> {
      return Ok(utils.op(pass1.Debugger, { table: node.table }).loc(node));
    },
  })
  .kw('has-block', {
    assert(node: ASTv2.AppendStatement, source: Source): pass1.SourceSlice {
      return assertValidHasBlockUsage('has-block', node, source);
    },
    translate(
      node: ASTv2.AppendStatement,
      { utils }: VisitorContext,
      target: pass1.SourceSlice
    ): Result<pass1.AppendTextNode> {
      let value = utils.op(pass1.HasBlock, { target }).loc(node);
      return Ok(utils.op(pass1.AppendTextNode, { value }).loc(node));
    },
  })
  .kw('has-block-params', {
    assert(node: ASTv2.AppendStatement, source: Source): pass1.SourceSlice {
      return assertValidHasBlockUsage('has-block-params', node, source);
    },
    translate(
      node: ASTv2.AppendStatement,
      { utils }: VisitorContext,
      target: pass1.SourceSlice
    ): Result<pass1.AppendTextNode> {
      let value = utils.op(pass1.HasBlockParams, { target }).loc(node);
      return Ok(utils.op(pass1.AppendTextNode, { value }).loc(node));
    },
  });

function extract(
  append: ASTv2.AppendStatement
): { func: ASTv2.Expression; params: ASTv2.InternalExpression[]; pairs: ASTv2.HashPair[] } {
  let value = append.value;

  if (value.type === 'SubExpression') {
    return {
      func: value.func,
      params: value.params,
      pairs: value.hash.pairs,
    };
  } else {
    return {
      func: value,
      params: [],
      pairs: [],
    };
  }
}
