import { ASTv2, GlimmerSyntaxError } from '@glimmer/syntax';
import { assertPresent } from '@glimmer/util';
import { Result } from '../../../shared/result';
import * as pass1 from '../../pass1/hir';
import { VisitorContext } from '../context';
import { keyword, KeywordNode, keywords } from './impl';

export const IN_ELEMENT = keyword('in-element', {
  assert(
    statement: ASTv2.BlockStatement
  ): { insertBefore?: ASTv2.Expression; destination: ASTv2.Expression } {
    let { hash } = statement;

    let insertBefore: ASTv2.Expression | undefined = undefined;
    let destination: ASTv2.Expression | undefined = undefined;

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
    node: KeywordNode<ASTv2.BlockStatement>,
    ctx: VisitorContext,
    {
      insertBefore,
      destination,
    }: { insertBefore?: ASTv2.Expression; destination: ASTv2.Expression }
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

export const BLOCK_KEYWORDS = keywords().add(IN_ELEMENT);
