import type { ASTv2 } from '@glimmer/syntax';
import { generateSyntaxError } from '@glimmer/syntax';

import type { NormalizationState } from '../../context';
import type { ContentKeywordCandidate, KeywordDelegate } from '../impl';

import { Err, Ok, Result } from '../../../../shared/result';
import * as mir from '../../../2-encoding/mir';
import { visitExpr } from '../../visitors/expressions';

function assertIfUnlessInlineKeyword(type: string) {
  return (
    originalNode: ContentKeywordCandidate
  ): Result<{
    condition: ASTv2.ExpressionValueNode;
    truthy: ASTv2.ExpressionValueNode;
    falsy: ASTv2.ExpressionValueNode | null;
  }> => {
    let inverted = type === 'unless';

    const { positional, named } = originalNode.args;

    if (!named.isEmpty()) {
      return Err(
        generateSyntaxError(
          `(${type}) cannot receive named parameters, received ${named.entries
            .map((e) => e.name.chars)
            .join(', ')}`,
          originalNode.loc
        )
      );
    }

    if (positional.isEmpty()) {
      return Err(
        generateSyntaxError(
          `When used inline, (${type}) requires at least two parameters 1. the condition that determines the state of the (${type}), and 2. the value to return if the condition is ${
            inverted ? 'false' : 'true'
          }. Did not receive any parameters`,
          originalNode.loc
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
          originalNode.loc
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
          originalNode.loc
        )
      );
    }

    return Ok({ condition, truthy, falsy });
  };
}

function translateIfUnlessInlineKeyword(type: string) {
  let inverted = type === 'unless';

  return (
    { node, state }: { node: ContentKeywordCandidate; state: NormalizationState },
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
          condition = new mir.Not({ value: condition, loc: node.loc });
        }

        return new mir.IfExpression({
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
  ContentKeywordCandidate,
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
