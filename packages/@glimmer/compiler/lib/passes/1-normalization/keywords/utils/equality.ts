import { ASTv2, generateSyntaxError } from '@glimmer/syntax';

import { Err, Ok, Result } from '../../../../shared/result';
import * as mir from '../../../2-encoding/mir';
import { NormalizationState } from '../../context';
import { VISIT_EXPRS } from '../../visitors/expressions';
import { GenericKeywordNode, KeywordDelegate } from '../impl';

function assertEqualKeyword(node: GenericKeywordNode): Result<ASTv2.PositionalArguments> {
  let {
    args: { named, positional },
  } = node;

  if (named && !named.isEmpty()) {
    return Err(generateSyntaxError(`(eq) does not take any named arguments`, node.loc));
  }

  return Ok(positional);
}

function translateEqualKeyword(
  { node, state }: { node: ASTv2.CallExpression; state: NormalizationState },
  positional: ASTv2.PositionalArguments
): Result<mir.Equal> {
  return VISIT_EXPRS.Positional(positional, state).mapOk(
    (positional) => new mir.Equal({ positional, loc: node.loc })
  );
}

export const equalKeyword: KeywordDelegate<
  ASTv2.CallExpression | ASTv2.AppendContent,
  ASTv2.PositionalArguments,
  mir.Equal
> = {
  assert: assertEqualKeyword,
  translate: translateEqualKeyword,
};

function assertNotEqualKeyword(node: GenericKeywordNode): Result<ASTv2.PositionalArguments> {
  let {
    args: { named, positional },
  } = node;

  if (named && !named.isEmpty()) {
    return Err(generateSyntaxError(`(neq) does not take any named arguments`, node.loc));
  }

  return Ok(positional);
}

function translateNotEqualKeyword(
  { node, state }: { node: ASTv2.CallExpression; state: NormalizationState },
  positional: ASTv2.PositionalArguments
): Result<mir.NotEqual> {
  return VISIT_EXPRS.Positional(positional, state).mapOk(
    (positional) => new mir.NotEqual({ positional, loc: node.loc })
  );
}

export const notEqualKeyword: KeywordDelegate<
  ASTv2.CallExpression | ASTv2.AppendContent,
  ASTv2.PositionalArguments,
  mir.NotEqual
> = {
  assert: assertNotEqualKeyword,
  translate: translateNotEqualKeyword,
};
