import { ASTv2, GlimmerSyntaxError } from '@glimmer/syntax';
import { Err, Ok, Result } from '../../../shared/result';
import * as hir from '../../2-symbol-allocation/hir';
import { NormalizationState } from '../context';
import { VISIT_EXPRS } from '../visitors/expressions';
import { VISIT_STMTS } from '../visitors/statements';
import { keywords } from './impl';

export const BLOCK_KEYWORDS = keywords('Block').kw('in-element', {
  assert(
    node: ASTv2.InvokeBlock
  ): Result<{
    insertBefore: ASTv2.ExpressionNode | null;
    destination: ASTv2.ExpressionNode;
  }> {
    let { args } = node;

    let guid = args.get('guid');

    if (guid) {
      return Err(
        new GlimmerSyntaxError(
          `Cannot pass \`guid\` to \`{{#in-element}}\` on line ${guid.loc.startPosition.line}.`,
          guid.loc
        )
      );
    }

    let insertBefore = args.get('insertBefore');
    let destination = args.nth(0);

    if (destination === null) {
      return Err(
        new GlimmerSyntaxError(
          `#in-element requires a target element as its first positional parameter`,
          args.loc
        )
      );
    }

    // TODO Better syntax checks

    return Ok({ insertBefore, destination });
  },

  translate(
    node: ASTv2.InvokeBlock,
    {
      insertBefore,
      destination,
    }: { insertBefore: ASTv2.ExpressionNode | null; destination: ASTv2.ExpressionNode },
    state: NormalizationState
  ): Result<hir.InElement> {
    let named = node.blocks.get('default');
    let body = VISIT_STMTS.NamedBlock(named, state);
    let destinationResult = VISIT_EXPRS.visit(destination);

    return Result.all(body, destinationResult)
      .andThen(
        ([body, destination]): Result<{
          body: hir.NamedBlock;
          destination: hir.Expr;
          insertBefore: hir.Expr | undefined;
        }> => {
          if (insertBefore) {
            return VISIT_EXPRS.visit(insertBefore).mapOk((insertBefore) => ({
              body,
              destination,
              insertBefore,
            }));
          }

          return Ok({ body, destination, insertBefore: undefined });
        }
      )
      .mapOk(
        ({ body, destination, insertBefore }) =>
          new hir.InElement(node.loc, {
            block: body,
            insertBefore,
            guid: state.generateUniqueCursor(),
            destination,
          })
      );
  },
});
