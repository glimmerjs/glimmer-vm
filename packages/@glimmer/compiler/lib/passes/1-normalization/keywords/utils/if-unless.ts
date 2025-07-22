import type { ASTv2 } from '@glimmer/syntax';
import { generateSyntaxError, GlimmerSyntaxError } from '@glimmer/syntax';

import type { ContentKeywordInfo, ContentKeywordMatch, KeywordDelegate } from '../impl';

import { Err, Ok, Result } from '../../../../shared/result';
import * as mir from '../../../2-encoding/mir';
import { visitExpr } from '../../visitors/expressions';

function assertIfUnlessInlineKeyword(type: string) {
  return ({
    args,
    loc,
  }: ContentKeywordInfo): Result<{
    condition: ASTv2.ExpressionValueNode;
    truthy: ASTv2.ExpressionValueNode;
    falsy: ASTv2.ExpressionValueNode | null;
  }> => {
    let inverted = type === 'unless';

    const { positional, named } = args;

    if (!named.isEmpty()) {
      return Err(
        GlimmerSyntaxError.highlight(
          `(${type}) cannot receive named parameters, received ${named.entries
            .map((e) => e.name.chars)
            .join(', ')}`,
          named.loc
            .highlight()
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            .withPrimary(args.named.entries[0]!.name.loc.highlight('invalid'))
        )
      );
    }

    if (positional.isEmpty()) {
      return Err(
        generateSyntaxError(
          `When used inline, (${type}) requires at least two parameters 1. the condition that determines the state of the (${type}), and 2. the value to return if the condition is ${
            inverted ? 'false' : 'true'
          }. Did not receive any parameters`,
          loc
        )
      );
    }

    const condition = positional.nth(0);
    const truthy = positional.nth(1);

    if (!condition || !truthy) {
      return Err(
        generateSyntaxError(
          `When used inline, (${type}) requires at least two parameters 1. the condition that determines the state of the (${type}), and 2. the value to return if the condition is ${
            inverted ? 'false' : 'true'
          }. Received only one parameter, the condition`,
          loc
        )
      );
    }

    const falsy = positional.nth(2);

    if (positional.size > 3) {
      return Err(
        generateSyntaxError(
          `When used inline, (${type}) can receive a maximum of three positional parameters 1. the condition that determines the state of the (${type}), 2. the value to return if the condition is ${
            inverted ? 'false' : 'true'
          }, and 3. the value to return if the condition is ${
            inverted ? 'true' : 'false'
          }. Received ${positional.size} parameters`,
          loc
        )
      );
    }

    return Ok({ condition, truthy, falsy });
  };
}

function translateIfUnlessInlineKeyword(type: string) {
  let inverted = type === 'unless';

  return (
    { node, keyword, state }: ContentKeywordInfo,
    {
      condition,
      truthy,
      falsy,
    }: {
      condition: ASTv2.ExpressionValueNode;
      truthy: ASTv2.ExpressionValueNode;
      falsy: ASTv2.ExpressionValueNode | null;
    }
  ): Result<mir.IfExpression> => {
    let conditionResult = visitExpr(condition, state);
    let truthyResult = visitExpr(truthy, state);
    let falsyResult = falsy ? visitExpr(falsy, state) : Ok(null);

    return Result.all(conditionResult, truthyResult, falsyResult).mapOk(
      ([condition, truthy, falsy]) => {
        if (inverted) {
          condition = new mir.Not({ keyword, value: condition, loc: node.loc });
        }

        return new mir.IfExpression({
          keyword,
          loc: node.loc,
          condition,
          truthy,
          falsy,
        });
      }
    );
  };
}

export function ifUnlessInlineKeyword(type: string): KeywordDelegate<
  ContentKeywordMatch,
  {
    condition: ASTv2.ExpressionValueNode;
    truthy: ASTv2.ExpressionValueNode;
    falsy: ASTv2.ExpressionValueNode | null;
  },
  mir.IfExpression
> {
  return {
    assert: assertIfUnlessInlineKeyword(type),
    translate: translateIfUnlessInlineKeyword(type),
  };
}
