import { ASTv2, generateSyntaxError } from '@glimmer/syntax';

import { Err, Ok, Result } from '../../../../shared/result';
import * as mir from '../../../2-encoding/mir';
import { NormalizationState } from '../../context';
import { VISIT_EXPRS } from '../../visitors/expressions';
import { GenericKeywordNode, KeywordDelegate } from '../impl';

function assertDynamicElementKeyword(node: GenericKeywordNode): Result<ASTv2.PositionalArguments> {
  let {
    args: { named, positional },
  } = node;

  if (named && !named.isEmpty()) {
    return Err(generateSyntaxError('(element) does not take any named arguments', node.loc));
  }

  if (positional && positional.size > 1) {
    return Err(generateSyntaxError('(element) only takes one positional argument - the element tag name', node.loc));
  }

  return Ok(positional);
}

function translateDynamicElementKeyword(
  { node, state }: { node: ASTv2.CallExpression; state: NormalizationState },
  positional: ASTv2.PositionalArguments
): Result<mir.DynamicElement> {
  return VISIT_EXPRS.Positional(positional, state).mapOk(
    (positional) => new mir.DynamicElement({ positional, loc: node.loc })
  );
}

export const dynamicElementKeyword: KeywordDelegate<
  ASTv2.CallExpression | ASTv2.AppendContent,
  ASTv2.PositionalArguments,
  mir.DynamicElement
> = {
  assert: assertDynamicElementKeyword,
  translate: translateDynamicElementKeyword,
};
