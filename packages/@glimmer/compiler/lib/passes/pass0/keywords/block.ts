import { ExpressionContext } from '@glimmer/interfaces';
import { AST, GlimmerSyntaxError } from '@glimmer/syntax';
import { assertPresent } from '@glimmer/util';
import * as pass1 from '../../pass1/ops';
import { Context } from '../context';
import { keyword, KeywordNode, keywords } from './impl';

export const IN_ELEMENT = keyword('in-element', {
  assert(
    statement: AST.BlockStatement
  ): { insertBefore?: AST.Expression; destination: AST.Expression } {
    let { hash } = statement;

    let insertBefore: AST.Expression | undefined = undefined;
    let destination: AST.Expression | undefined = undefined;

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

    destination = assertPresent(statement.params)[0];

    // TODO Better syntax checks

    return { insertBefore, destination };
  },

  translate(
    block: KeywordNode<AST.BlockStatement>,
    ctx: Context,
    { insertBefore, destination }: { insertBefore?: AST.Expression; destination: AST.Expression }
  ): pass1.InElement {
    let guid = ctx.cursor();

    return ctx
      .op(pass1.InElement, {
        block: ctx.visitBlock(ctx.slice('default').offsets(null), block.program),
        insertBefore: insertBefore
          ? ctx.visitExpr(insertBefore, ExpressionContext.Expression)
          : undefined,
        guid,
        destination: ctx.visitExpr(destination, ExpressionContext.Expression),
      })
      .loc(block);
  },
});

export const BLOCK_KEYWORDS = keywords().add(IN_ELEMENT);
