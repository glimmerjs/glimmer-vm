import { Args, ASTv2, GlimmerSyntaxError, Source, SourceSlice } from '@glimmer/syntax';
import { expect, unreachable } from '@glimmer/util';
import { Err, Ok, Result } from '../../../shared/result';
import * as hir from '../../2-symbol-allocation/hir';
import { NormalizationUtilities } from '../context';
import { VISIT_EXPRS } from '../visitors/expressions';
import { assertValidHasBlockUsage } from './has-block';
import { keywords } from './impl';

export const APPEND_KEYWORDS = keywords('Append')
  .kw('yield', {
    assert(
      node: ASTv2.AppendContent,
      source: Source
    ): Result<{
      target: SourceSlice;
      positional: ASTv2.Positional;
    }> {
      let { args } = node;

      if (args.named.isEmpty()) {
        return Ok({
          target: new SourceSlice({ loc: source.NOT_IN_SOURCE, chars: 'default' }),
          positional: args.positional,
        });
      } else {
        let target = args.named.get('to');

        if (args.named.size > 1 || target === null) {
          return Err(
            new GlimmerSyntaxError(`yield only takes a single named argument: 'to'`, args.named.loc)
          );
        }

        if (ASTv2.isLiteral(target, 'string')) {
          return Ok({ target: target.toSlice(), positional: args.positional });
        } else {
          return Err(
            new GlimmerSyntaxError(`you can only yield to a literal string value`, target.loc)
          );
        }
      }
    },

    translate(
      node: ASTv2.AppendContent,
      utils: NormalizationUtilities,
      {
        target,
        positional,
      }: {
        target: SourceSlice;
        positional: ASTv2.Positional;
      }
    ): Result<hir.Statement> {
      let params = VISIT_EXPRS.Positional(positional, utils);
      return Ok(
        utils
          .op(hir.Yield, {
            target,
            positional: params,
          })
          .loc(node)
      );
    },
  })
  .kw('partial', {
    assert(node: ASTv2.AppendContent): Result<ASTv2.Expression | undefined> {
      let {
        args: { positional, named },
      } = node;
      let { trusting, loc } = node;

      if (positional.isEmpty()) {
        return Err(
          new GlimmerSyntaxError(
            `Partial found with no arguments. You must specify a template name. (on line ${loc.start.line})`,
            node.loc
          )
        );
      } else if (positional.size !== 1) {
        return Err(
          new GlimmerSyntaxError(
            `Partial found with ${positional.exprs.length} arguments. You must specify a template name. (on line ${loc.start.line})`,
            node.loc
          )
        );
      }

      if (named.isEmpty()) {
        if (trusting) {
          return Err(
            new GlimmerSyntaxError(
              `{{{partial ...}}} is not supported, please use {{partial ...}} instead (on line ${loc.start.line})`,
              node.loc
            )
          );
        }

        return Ok(expect(positional.nth(0), `already confirmed that positional has a 0th entry`));
      } else {
        return Err(
          new GlimmerSyntaxError(
            `Partial does not take any named arguments (on line ${loc.start.line})`,
            node.loc
          )
        );
      }
    },

    translate(
      node: ASTv2.AppendContent,
      utils: NormalizationUtilities,
      expr: ASTv2.Expression | undefined
    ): Result<hir.Statement> {
      return Ok(
        utils
          .op(hir.Partial, {
            table: node.table,
            expr:
              expr === undefined
                ? VISIT_EXPRS.visit(
                    new ASTv2.Builder(utils.source).literal(undefined, utils.source.NOT_IN_SOURCE),
                    utils
                  )
                : VISIT_EXPRS.visit(expr, utils),
          })
          .loc(node)
      );
    },
  })
  .kw('debugger', {
    assert(node: ASTv2.AppendContent): Result<void> {
      let { args } = node;
      let { positional } = args;

      if (args.isEmpty()) {
        return Ok(undefined);
      } else {
        if (positional.isEmpty()) {
          return Err(
            new GlimmerSyntaxError(`debugger does not take any named arguments`, node.loc)
          );
        } else {
          return Err(
            new GlimmerSyntaxError(`debugger does not take any positional arguments`, node.loc)
          );
        }
      }
    },

    translate(node: ASTv2.AppendContent, utils: NormalizationUtilities): Result<hir.Statement> {
      return Ok(utils.op(hir.Debugger, { table: node.table }).loc(node));
    },
  })
  .kw('has-block', {
    assert(node: ASTv2.AppendContent, source: Source): Result<SourceSlice> {
      return assertValidHasBlockUsage('has-block', node, source);
    },
    translate(
      node: ASTv2.AppendContent,
      utils: NormalizationUtilities,
      target: SourceSlice
    ): Result<hir.AppendTextNode> {
      let value = utils.op(hir.HasBlock, { target }).loc(node);
      return Ok(utils.op(hir.AppendTextNode, { value }).loc(node));
    },
  })
  .kw('has-block-params', {
    assert(node: ASTv2.AppendContent, source: Source): Result<SourceSlice> {
      return assertValidHasBlockUsage('has-block-params', node, source);
    },
    translate(
      node: ASTv2.AppendContent,
      utils: NormalizationUtilities,
      target: SourceSlice
    ): Result<hir.AppendTextNode> {
      let value = utils.op(hir.HasBlockParams, { target }).loc(node);
      return Ok(utils.op(hir.AppendTextNode, { value }).loc(node));
    },
  });
