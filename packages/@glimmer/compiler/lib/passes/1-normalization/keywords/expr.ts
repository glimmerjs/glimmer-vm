import { SourceSlice } from '@glimmer/syntax';
import { Ok, Result } from '../../../shared/result';
import * as hir from '../../2-symbol-allocation/hir';
import { VisitorContext } from '../context';
import { assertValidHasBlockUsage } from './has-block';
import { ExprKeywordNode, keywords } from './impl';

export const EXPR_KEYWORDS = keywords('Expr')
  .kw('has-block', {
    assert(node: ExprKeywordNode): SourceSlice {
      return assertValidHasBlockUsage('has-block', node);
    },
    translate(
      node: ExprKeywordNode,
      { utils }: VisitorContext,
      target: SourceSlice
    ): Result<hir.HasBlock> {
      return Ok(utils.op(hir.HasBlock, { target }).loc(node));
    },
  })
  .kw('has-block-params', {
    assert(node: ExprKeywordNode): SourceSlice {
      return assertValidHasBlockUsage('has-block-params', node);
    },
    translate(
      node: ExprKeywordNode,
      { utils }: VisitorContext,
      target: SourceSlice
    ): Result<hir.HasBlockParams> {
      return Ok(utils.op(hir.HasBlockParams, { target }).loc(node));
    },
  });
