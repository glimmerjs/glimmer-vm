import { ASTv2, GlimmerSyntaxError } from '@glimmer/syntax';
import { assertPresent } from '@glimmer/util';
import { Result } from '../../../shared/result';
import * as pass1 from '../../2-symbol-allocation/hir';
import { VisitorContext } from '../context';
import { VISIT_EXPRS } from '../visitors/expressions';
import { keywords } from './impl';

export const BLOCK_KEYWORDS = keywords('Block').kw('in-element', {
  assert(
    node: ASTv2.InvokeBlock
  ): {
    insertBefore?: ASTv2.Expression;
    destination: ASTv2.Expression;
  } {
    let {
      args: { named, positional },
    } = node;

    let insertBefore: ASTv2.Expression | undefined = undefined;
    let destination: ASTv2.Expression | undefined = undefined;

    for (let { name, value } of named.entries) {
      if (name.chars === 'guid') {
        throw new GlimmerSyntaxError(
          `Cannot pass \`guid\` to \`{{#in-element}}\` on line ${value.loc.start.line}.`,
          value.loc
        );
      }

      if (name.chars === 'insertBefore') {
        insertBefore = value;
      }
    }

    destination = assertPresent(positional.exprs as ASTv2.Expression[])[0];

    // TODO Better syntax checks

    return { insertBefore, destination };
  },

  translate(
    node: ASTv2.InvokeBlock,
    ctx: VisitorContext,
    {
      insertBefore,
      destination,
    }: { insertBefore?: ASTv2.Expression; destination: ASTv2.Expression }
  ): Result<pass1.InElement> {
    let { utils } = ctx;

    let named = ASTv2.getBlock(node.blocks, 'default');

    return ctx.block(utils.slice('default'), named.block).mapOk((body) =>
      utils
        .op(pass1.InElement, {
          block: body,
          insertBefore: insertBefore ? VISIT_EXPRS.visit(insertBefore, ctx) : undefined,
          guid: ctx.generateUniqueCursor(),
          destination: VISIT_EXPRS.visit(destination, ctx),
        })
        .loc(node)
    );
  },
});
