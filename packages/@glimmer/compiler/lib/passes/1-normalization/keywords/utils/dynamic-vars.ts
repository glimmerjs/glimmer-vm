import type { ASTv2 } from '@glimmer/syntax';
import { generateSyntaxError } from '@glimmer/syntax';

import type { Result } from '../../../../shared/result';
import type { NormalizationState } from '../../context';
import type { InvokeKeywordCandidate, KeywordDelegate } from '../impl';

import { Err, Ok } from '../../../../shared/result';
import * as mir from '../../../2-encoding/mir';
import { visitExpr } from '../../visitors/expressions';

function assertGetDynamicVarKeyword(
  node: InvokeKeywordCandidate
): Result<ASTv2.ExpressionValueNode> {
  const args = node.args;

  if (args.isEmpty()) {
    return Err(generateSyntaxError(`(-get-dynamic-vars) requires a var name to get`, node.loc));
  }

  const { positional, named } = args;

  if (!named.isEmpty()) {
    return Err(
      generateSyntaxError(`(-get-dynamic-vars) does not take any named arguments`, node.loc)
    );
  }

  let varName = positional.nth(0);

  if (!varName) {
    return Err(generateSyntaxError(`(-get-dynamic-vars) requires a var name to get`, node.loc));
  }

  if (args.positional.size > 1) {
    return Err(
      generateSyntaxError(`(-get-dynamic-vars) only receives one positional arg`, node.loc)
    );
  }

  return Ok(varName);
}

function translateGetDynamicVarKeyword(
  { node, state }: { node: InvokeKeywordCandidate; state: NormalizationState },
  name: ASTv2.ExpressionValueNode
): Result<mir.GetDynamicVar> {
  return visitExpr(name, state).mapOk((name) => new mir.GetDynamicVar({ name, loc: node.loc }));
}

export const getDynamicVarKeyword: KeywordDelegate<
  InvokeKeywordCandidate,
  ASTv2.ExpressionValueNode,
  mir.GetDynamicVar
> = {
  assert: assertGetDynamicVarKeyword,
  translate: translateGetDynamicVarKeyword,
};
