import type { ASTv2 } from '@glimmer/syntax';
import { generateSyntaxError } from '@glimmer/syntax';

import type { Result } from '../../../../shared/result';
import type { InvokeKeywordInfo, InvokeKeywordMatch, KeywordDelegate } from '../impl';

import { Err, Ok } from '../../../../shared/result';
import * as mir from '../../../2-encoding/mir';
import { visitExpr } from '../../visitors/expressions';

function assertGetDynamicVarKeyword({
  args,
  loc,
}: InvokeKeywordInfo): Result<ASTv2.ExpressionValueNode> {
  if (args.isEmpty()) {
    return Err(generateSyntaxError(`(-get-dynamic-vars) requires a var name to get`, loc));
  }

  const { positional, named } = args;

  if (!named.isEmpty()) {
    return Err(generateSyntaxError(`(-get-dynamic-vars) does not take any named arguments`, loc));
  }

  let varName = positional.nth(0);

  if (!varName) {
    return Err(generateSyntaxError(`(-get-dynamic-vars) requires a var name to get`, loc));
  }

  if (args.positional.size > 1) {
    return Err(generateSyntaxError(`(-get-dynamic-vars) only receives one positional arg`, loc));
  }

  return Ok(varName);
}

function translateGetDynamicVarKeyword(
  { node, keyword, state }: InvokeKeywordInfo,
  name: ASTv2.ExpressionValueNode
): Result<mir.GetDynamicVar> {
  return visitExpr(name, state).mapOk(
    (name) => new mir.GetDynamicVar({ keyword, name, loc: node.loc })
  );
}

export const getDynamicVarKeyword: KeywordDelegate<
  InvokeKeywordMatch,
  ASTv2.ExpressionValueNode,
  mir.GetDynamicVar
> = {
  assert: assertGetDynamicVarKeyword,
  translate: translateGetDynamicVarKeyword,
};
