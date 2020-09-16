import { Ok, Result } from '../../../shared/result';
import { Source } from '../../../source/source';
import * as pass1 from '../../2-symbol-allocation/hir';
import { VisitorContext } from '../context';
import { assertValidHasBlockUsage } from './has-block';
import { ExprKeywordNode, keywords } from './impl';

export const EXPR_KEYWORDS = keywords('Expr')
  .kw('has-block', {
    assert(node: ExprKeywordNode, source: Source): pass1.SourceSlice {
      return assertValidHasBlockUsage('has-block', node, source);
    },
    translate(
      node: ExprKeywordNode,
      { utils }: VisitorContext,
      target: pass1.SourceSlice
    ): Result<pass1.HasBlock> {
      return Ok(utils.op(pass1.HasBlock, { target }).loc(node));
    },
  })
  .kw('has-block-params', {
    assert(node: ExprKeywordNode, source: Source): pass1.SourceSlice {
      return assertValidHasBlockUsage('has-block-params', node, source);
    },
    translate(
      node: ExprKeywordNode,
      { utils }: VisitorContext,
      target: pass1.SourceSlice
    ): Result<pass1.HasBlockParams> {
      return Ok(utils.op(pass1.HasBlockParams, { target }).loc(node));
    },
  });
