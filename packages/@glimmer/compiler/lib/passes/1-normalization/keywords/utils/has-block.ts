import {
  ASTv2,
  generateSyntaxError,
  quoteReportable,
  SourceSlice,
  Validation as Validation,
} from '@glimmer/syntax';

import type { Result } from '../../../../shared/result';
import type { InvokeKeywordInfo, InvokeKeywordMatch, KeywordDelegate } from '../impl';

import { Err, Ok } from '../../../../shared/result';
import * as mir from '../../../2-encoding/mir';

function assertHasBlockKeyword(type: string) {
  return ({ args, keyword, loc }: InvokeKeywordInfo): Result<SourceSlice> => {
    const { positional, named } = args;

    if (!named.isEmpty()) {
      return Err(generateSyntaxError(`(${type}) does not take any named arguments`, loc));
    }

    const positionals = positional.asPresent();

    if (!positionals) {
      return Ok(SourceSlice.synthetic('default'));
    }

    const [first, second, ...rest] = positionals.exprs;

    if (second) {
      const message = `\`${type}\` only takes a single positional argument`;
      const problem = rest.length > 0 ? 'extra arguments' : 'extra argument';
      return Err(
        quoteReportable(
          Validation.error(second.loc.withEnd(positionals.loc.getEnd()), message, problem, {
            header: keyword,
            content: loc,
          })
        )
      );
    }

    if (ASTv2.isLiteral(first, 'string')) {
      return Ok(first.toSlice());
    } else {
      return Err(
        generateSyntaxError(
          `(${type}) can only receive a string literal as its first argument`,
          loc
        )
      );
    }
  };
}

function translateHasBlockKeyword(type: string) {
  return (
    { node, keyword, state: { scope } }: InvokeKeywordInfo,
    target: SourceSlice
  ): Result<mir.HasBlock | mir.HasBlockParams> => {
    let block =
      type === 'has-block'
        ? new mir.HasBlock({
            keyword,
            loc: node.loc,
            target,
            symbol: scope.allocateBlock(target.chars),
          })
        : new mir.HasBlockParams({
            keyword,
            loc: node.loc,
            target,
            symbol: scope.allocateBlock(target.chars),
          });

    return Ok(block);
  };
}

export function hasBlockKeyword(
  type: string
): KeywordDelegate<InvokeKeywordMatch, SourceSlice, mir.HasBlock | mir.HasBlockParams> {
  return {
    assert: assertHasBlockKeyword(type),
    translate: translateHasBlockKeyword(type),
  };
}
