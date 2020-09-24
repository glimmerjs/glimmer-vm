import { SourceSlice } from '@glimmer/syntax';

import { Ok, Result } from '../../../shared/result';
import * as hir from '../../2-symbol-allocation/hir';
import { assertValidHasBlockUsage } from './has-block';
import { ExprKeywordNode, keywords } from './impl';

export const EXPR_KEYWORDS = keywords('Expr')
  .kw('has-block', {
    assert(node: ExprKeywordNode): Result<SourceSlice> {
      return assertValidHasBlockUsage('has-block', node);
    },
    translate(node: ExprKeywordNode, target: SourceSlice): Result<hir.HasBlock> {
      return Ok(new hir.HasBlock(node.loc, { target }));
    },
  })
  .kw('has-block-params', {
    assert(node: ExprKeywordNode): Result<SourceSlice> {
      return assertValidHasBlockUsage('has-block-params', node);
    },
    translate(node: ExprKeywordNode, target: SourceSlice): Result<hir.HasBlockParams> {
      return Ok(new hir.HasBlockParams(node.loc, { target }));
    },
  });
