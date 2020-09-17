import { Args, ASTv2, GlimmerSyntaxError, SourceSlice } from '@glimmer/syntax';
import { Ok, Result } from '../../../shared/result';
import * as pass1 from '../../2-symbol-allocation/hir';
import { VisitorContext } from '../context';
import { VISIT_EXPRS } from '../visitors/expressions';
import { assertValidHasBlockUsage } from './has-block';
import { keywords, Match } from './impl';

const builders = ASTv2.builders;

export const APPEND_KEYWORDS = keywords('Append')
  .kw('yield', {
    assert(
      node: ASTv2.AppendContent
    ): {
      target: ASTv2.LiteralExpression<string>;
      positional: ASTv2.Positional;
      kw: ASTv2.Expression;
    } {
      let { func: kw, args } = extract(node);

      if (args.named.isEmpty()) {
        return { target: builders.literal('default'), positional: args.positional, kw };
      } else {
        let entries = args.named.entries;
        let first = entries[0];

        if (entries.length > 1 || first.name.chars !== 'to') {
          throw new GlimmerSyntaxError(`yield only takes a single named argument: 'to'`, first.loc);
        }

        let target = first.value;

        if (!target.isLiteral('string')) {
          throw new GlimmerSyntaxError(`you can only yield to a literal string value`, target.loc);
        }

        return { target, positional: args.positional, kw };
      }
    },

    translate(
      node: ASTv2.AppendContent,
      { utils }: VisitorContext,
      {
        target,
        positional,
        kw,
      }: {
        target: ASTv2.LiteralExpression<'string'>;
        positional: ASTv2.Positional;
        kw: ASTv2.Expression;
      }
    ): Result<pass1.Statement> {
      let params = utils.params({ func: kw, positional });
      return Ok(
        utils
          .op(pass1.Yield, {
            target: utils.slice(target.value, utils.source.offsetsFor(target)),
            params,
          })
          .loc(node)
      );
    },
  })
  .kw('partial', {
    assert(node: ASTv2.AppendContent): ASTv2.Expression | undefined {
      let {
        args: { positional, named },
      } = extract(node);
      let { trusting, loc } = node;

      let hasParams = !positional.isEmpty();

      if (!hasParams) {
        throw new GlimmerSyntaxError(
          `Partial found with no arguments. You must specify a template name. (on line ${loc.start.line})`,
          node.loc
        );
      }

      if (hasParams && positional.exprs.length !== 1) {
        throw new GlimmerSyntaxError(
          `Partial found with ${positional.exprs.length} arguments. You must specify a template name. (on line ${loc.start.line})`,
          node.loc
        );
      }

      if (!named.isEmpty()) {
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

      return positional.exprs[0];
    },

    translate(
      node: ASTv2.AppendContent,
      ctx: VisitorContext,
      expr: ASTv2.Expression | undefined
    ): Result<pass1.Statement> {
      return Ok(
        ctx.utils
          .op(pass1.Partial, {
            table: node.table,
            expr:
              expr === undefined
                ? VISIT_EXPRS.visit(builders.literal(undefined), ctx)
                : VISIT_EXPRS.visit(expr, ctx),
          })
          .loc(node)
      );
    },
  })
  .kw('debugger', {
    assert(node: ASTv2.AppendContent): void {
      let {
        args: { positional, named },
      } = extract(node);

      if (!positional.isEmpty()) {
        throw new GlimmerSyntaxError(`debugger does not take any named arguments`, node.loc);
      }

      if (!named.isEmpty()) {
        throw new GlimmerSyntaxError(`debugger does not take any positional arguments`, node.loc);
      }
    },

    translate(node: Match<'Append'>, { utils }: VisitorContext): Result<pass1.Statement> {
      return Ok(utils.op(pass1.Debugger, { table: node.table }).loc(node));
    },
  })
  .kw('has-block', {
    assert(node: ASTv2.AppendContent): SourceSlice {
      return assertValidHasBlockUsage('has-block', node);
    },
    translate(
      node: ASTv2.AppendContent,
      { utils }: VisitorContext,
      target: SourceSlice
    ): Result<pass1.AppendTextNode> {
      let value = utils.op(pass1.HasBlock, { target }).loc(node);
      return Ok(utils.op(pass1.AppendTextNode, { value }).loc(node));
    },
  })
  .kw('has-block-params', {
    assert(node: ASTv2.AppendContent): SourceSlice {
      return assertValidHasBlockUsage('has-block-params', node);
    },
    translate(
      node: ASTv2.AppendContent,
      { utils }: VisitorContext,
      target: SourceSlice
    ): Result<pass1.AppendTextNode> {
      let value = utils.op(pass1.HasBlockParams, { target }).loc(node);
      return Ok(utils.op(pass1.AppendTextNode, { value }).loc(node));
    },
  });

function extract(append: ASTv2.AppendContent): { func: ASTv2.Expression; args: ASTv2.Args } {
  let value = append.value;

  if (value.type === 'CallExpression') {
    return {
      func: value.callee,
      args: value.args,
    };
  } else {
    return {
      func: value,
      args: Args.empty(),
    };
  }
}
