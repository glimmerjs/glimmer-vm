import { ASTv2, GlimmerSyntaxError, SourceSlice, SourceSpan } from '@glimmer/syntax';
import { expect } from '@glimmer/util';

import { Err, Ok, Result } from '../../../shared/result';
import * as hir from '../../2-symbol-allocation/hir';
import { VISIT_EXPRS } from '../visitors/expressions';
import { assertValidHasBlockUsage } from './has-block';
import { keywords } from './impl';

export const APPEND_KEYWORDS = keywords('Append')
  .kw('yield', {
    assert(
      node: ASTv2.AppendContent
    ): Result<{
      target: SourceSlice;
      positional: ASTv2.PositionalArguments;
    }> {
      let { args } = node;

      if (args.named.isEmpty()) {
        return Ok({
          target: SourceSpan.synthetic('default').toSlice(),
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
      {
        target,
        positional,
      }: {
        target: SourceSlice;
        positional: ASTv2.PositionalArguments;
      }
    ): Result<hir.Statement> {
      return VISIT_EXPRS.Positional(positional).mapOk(
        (positional) => new hir.Yield(node.loc, { target, positional })
      );
    },
  })
  .kw('partial', {
    assert(node: ASTv2.AppendContent): Result<ASTv2.ExpressionNode | undefined> {
      let {
        args: { positional, named },
      } = node;
      let { trusting, loc } = node;

      if (positional.isEmpty()) {
        return Err(
          new GlimmerSyntaxError(
            `Partial found with no arguments. You must specify a template name. (on line ${loc.startPosition.line})`,
            node.loc
          )
        );
      } else if (positional.size !== 1) {
        return Err(
          new GlimmerSyntaxError(
            `Partial found with ${positional.exprs.length} arguments. You must specify a template name. (on line ${loc.startPosition.line})`,
            node.loc
          )
        );
      }

      if (named.isEmpty()) {
        if (trusting) {
          return Err(
            new GlimmerSyntaxError(
              `{{{partial ...}}} is not supported, please use {{partial ...}} instead (on line ${loc.startPosition.line})`,
              node.loc
            )
          );
        }

        return Ok(expect(positional.nth(0), `already confirmed that positional has a 0th entry`));
      } else {
        return Err(
          new GlimmerSyntaxError(
            `Partial does not take any named arguments (on line ${loc.startPosition.line})`,
            node.loc
          )
        );
      }
    },

    translate(
      node: ASTv2.AppendContent,
      expr: ASTv2.ExpressionNode | undefined
    ): Result<hir.Statement> {
      let visited =
        expr === undefined
          ? Ok(new hir.PlaceholderUndefined(SourceSpan.synthetic('undefined'), undefined))
          : VISIT_EXPRS.visit(expr);

      return visited.mapOk((expr) => new hir.Partial(node.loc, { table: node.table, expr }));
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

    translate(node: ASTv2.AppendContent): Result<hir.Statement> {
      return Ok(new hir.Debugger(node.loc, { table: node.table }));
    },
  })
  .kw('has-block', {
    assert(node: ASTv2.AppendContent): Result<SourceSlice> {
      return assertValidHasBlockUsage('has-block', node);
    },
    translate(node: ASTv2.AppendContent, target: SourceSlice): Result<hir.AppendTextNode> {
      let value = new hir.HasBlock(node.loc, { target });
      return Ok(new hir.AppendTextNode(node.loc, { value }));
    },
  })
  .kw('has-block-params', {
    assert(node: ASTv2.AppendContent): Result<SourceSlice> {
      return assertValidHasBlockUsage('has-block-params', node);
    },
    translate(node: ASTv2.AppendContent, target: SourceSlice): Result<hir.AppendTextNode> {
      let value = new hir.HasBlockParams(node.loc, { target });
      return Ok(new hir.AppendTextNode(node.loc, { value }));
    },
  });
