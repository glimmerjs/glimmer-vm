import type { ASTv2 } from '@glimmer/syntax';
import { generateSyntaxError } from '@glimmer/syntax';

import type { Result } from '../../../../shared/result';
import type { NormalizationState } from '../../context';
import type { InvokeKeywordCandidate, KeywordDelegate } from '../impl';

import { Err, Ok } from '../../../../shared/result';
import * as mir from '../../../2-encoding/mir';
import { visitPositional } from '../../visitors/expressions';

function assertLogKeyword(node: InvokeKeywordCandidate): Result<ASTv2.PositionalArguments> {
  let {
    args: { named, positional },
  } = node;

  if (named.isEmpty()) {
    return Ok(positional);
  } else {
    return Err(generateSyntaxError(`(log) does not take any named arguments`, node.loc));
  }
}

function translateLogKeyword(
  { node, state }: { node: InvokeKeywordCandidate; state: NormalizationState },
  positional: ASTv2.PositionalArguments
): Result<mir.Log> {
  return visitPositional(positional, state).mapOk(
    (positional) => new mir.Log({ positional, loc: node.loc })
  );
}

export const logKeyword: KeywordDelegate<
  InvokeKeywordCandidate,
  ASTv2.PositionalArguments,
  mir.Log
> = {
  assert: assertLogKeyword,
  translate: translateLogKeyword,
};
