import { ASTv2, GlimmerSyntaxError } from '@glimmer/syntax';
import { assertPresent } from '@glimmer/util';
import { Result } from '../../../shared/result';
import * as pass1 from '../../2-symbol-allocation/hir';
import { VisitorContext } from '../context';
import { keywords } from './impl';

export const BLOCK_KEYWORDS = keywords('Block').kw('in-element', {
  assert(
    node: ASTv2.BlockStatement
  ): {
    insertBefore?: ASTv2.InternalExpression;
    destination: ASTv2.InternalExpression;
  } {
    let { hash } = node;

    let insertBefore: ASTv2.InternalExpression | undefined = undefined;
    let destination: ASTv2.InternalExpression | undefined = undefined;

    for (let { key, value } of hash.pairs) {
      if (key === 'guid') {
        throw new GlimmerSyntaxError(
          `Cannot pass \`guid\` to \`{{#in-element}}\` on line ${value.loc.start.line}.`,
          value.loc
        );
      }

      if (key === 'insertBefore') {
        insertBefore = value;
      }
    }

    destination = assertPresent(node.params)[0];

    // TODO Better syntax checks

    return { insertBefore, destination };
  },

  translate(
    node: ASTv2.BlockStatement,
    ctx: VisitorContext,
    {
      insertBefore,
      destination,
    }: { insertBefore?: ASTv2.InternalExpression; destination: ASTv2.InternalExpression }
  ): Result<pass1.InElement> {
    let { utils } = ctx;

    return ctx.block(utils.slice('default').offsets(null), node.program).mapOk((body) =>
      utils
        .op(pass1.InElement, {
          block: body,
          insertBefore: insertBefore ? ctx.utils.visitExpr(insertBefore) : undefined,
          guid: ctx.generateUniqueCursor(),
          destination: ctx.utils.visitExpr(destination),
        })
        .loc(node)
    );
  },
});
