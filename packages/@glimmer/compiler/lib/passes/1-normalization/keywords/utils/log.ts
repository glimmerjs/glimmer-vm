import type { ASTv2 } from '@glimmer/syntax';
import { generateSyntaxError } from '@glimmer/syntax';

import type { Result } from '../../../../shared/result';
import type { InvokeKeywordInfo, InvokeKeywordMatch, KeywordDelegate } from '../impl';

import { Err, Ok } from '../../../../shared/result';
import * as mir from '../../../2-encoding/mir';
import { visitPositional } from '../../visitors/expressions';

function assertLogKeyword({ args, loc }: InvokeKeywordInfo): Result<ASTv2.PositionalArguments> {
  let { named, positional } = args;

  if (named.isEmpty()) {
    return Ok(positional);
  } else {
    return Err(generateSyntaxError(`(log) does not take any named arguments`, loc));
  }
}

function translateLogKeyword(
  { node, keyword, state }: InvokeKeywordInfo,
  positional: ASTv2.PositionalArguments
): Result<mir.Log> {
  return visitPositional(positional, state).mapOk(
    (positional) => new mir.Log({ keyword, positional, loc: node.loc })
  );
}

export const logKeyword: KeywordDelegate<InvokeKeywordMatch, ASTv2.PositionalArguments, mir.Log> = {
  assert: assertLogKeyword,
  translate: translateLogKeyword,
};
