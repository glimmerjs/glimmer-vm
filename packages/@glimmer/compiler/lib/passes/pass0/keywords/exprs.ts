import { ASTv2, GlimmerSyntaxError } from '@glimmer/syntax';
import { Ok, Result } from '../../../shared/result';
import * as pass1 from '../../pass1/hir';
import { ImmutableUtils, VisitorContext } from '../context';
import { keyword, KeywordNode, keywords } from './impl';

export const HAS_BLOCK = keyword('has-block', {
  assert(node: ASTv2.Call | ASTv2.PathExpression, utils: ImmutableUtils): pass1.SourceSlice {
    return assertValidHasBlockUsage('has-block', node, utils);
  },
  translate(
    node: KeywordNode<ASTv2.Call | ASTv2.PathExpression>,
    { utils }: VisitorContext,
    target: pass1.SourceSlice
  ): Result<pass1.HasBlock> {
    return Ok(utils.op(pass1.HasBlock, { target }).loc(node));
  },
});

export const HAS_BLOCK_PARAMS = keyword('has-block-params', {
  assert(node: ASTv2.Call | ASTv2.PathExpression, ctx: ImmutableUtils): pass1.SourceSlice {
    return assertValidHasBlockUsage('has-block-params', node, ctx);
  },
  translate(
    node: KeywordNode<ASTv2.Call | ASTv2.PathExpression>,
    { utils }: VisitorContext,
    target: pass1.SourceSlice
  ): Result<pass1.HasBlockParams> {
    return Ok(utils.op(pass1.HasBlockParams, { target }).loc(node));
  },
});

export const EXPR_KEYWORDS = keywords().add(HAS_BLOCK).add(HAS_BLOCK_PARAMS);

export function assertValidHasBlockUsage(
  type: string,
  call: ASTv2.Call | ASTv2.PathExpression,
  utils: ImmutableUtils
): pass1.SourceSlice {
  let { params, hash, loc } = call;

  if (hash && hash.pairs.length > 0) {
    throw new GlimmerSyntaxError(`${type} does not take any named arguments`, call.loc);
  }

  if (params.length === 0) {
    return utils.slice('default').offsets(null);
  } else if (params.length === 1) {
    let param = params[0];
    if (ASTv2.isLiteral(param, 'string')) {
      return utils.slice(param.value).offsets(null);
    } else {
      throw new GlimmerSyntaxError(
        `you can only yield to a literal value (on line ${loc.start.line})`,
        call.loc
      );
    }
  } else {
    throw new GlimmerSyntaxError(
      `${type} only takes a single positional argument (on line ${loc.start.line})`,
      call.loc
    );
  }
}
