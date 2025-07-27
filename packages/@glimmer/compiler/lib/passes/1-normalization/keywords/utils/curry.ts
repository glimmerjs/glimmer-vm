import type { CurriedType } from '@glimmer/interfaces';
import { CURRIED_COMPONENT, CURRIED_HELPER, CURRIED_MODIFIER } from '@glimmer/constants';
import { ASTv2, generateSyntaxError } from '@glimmer/syntax';

import type {
  ContentKeywordInfo,
  ContentKeywordMatch,
  KeywordDelegate,
  KeywordInfo,
} from '../impl';

import { Err, Ok, Result } from '../../../../shared/result';
import * as mir from '../../../2-encoding/mir';
import { visitCurlyArgs, visitExpr } from '../../visitors/expressions';

const CurriedTypeToReadableType = {
  [CURRIED_COMPONENT]: 'component',
  [CURRIED_HELPER]: 'helper',
  [CURRIED_MODIFIER]: 'modifier',
} as const;

export function assertCurryKeyword(curriedType: CurriedType): ({
  node,
  state,
  args,
}: KeywordInfo<ContentKeywordMatch>) => Result<{
  definition: ASTv2.ExpressionValueNode;
  args: ASTv2.CurlyArgs;
}> {
  return ({
    node,
    state,
    args,
  }): Result<{ definition: ASTv2.ExpressionValueNode; args: ASTv2.CurlyArgs }> => {
    let readableType = CurriedTypeToReadableType[curriedType];
    let stringsAllowed = curriedType === CURRIED_COMPONENT;

    let definition = args.nth(0);

    if (definition === null) {
      return Err(
        generateSyntaxError(
          `(${readableType}) requires a ${readableType} definition or identifier as its first positional parameter, did not receive any parameters.`,
          args.loc
        )
      );
    }

    if (definition.type === 'Literal') {
      if (stringsAllowed && state.isStrict) {
        return Err(
          generateSyntaxError(
            `(${readableType}) cannot resolve string values in strict mode templates`,
            node.loc
          )
        );
      } else if (!stringsAllowed) {
        return Err(
          generateSyntaxError(
            `(${readableType}) cannot resolve string values, you must pass a ${readableType} definition directly`,
            node.loc
          )
        );
      } else if (curriedType === CURRIED_HELPER || curriedType === CURRIED_MODIFIER) {
        return Err(
          generateSyntaxError(
            `(${readableType}) cannot resolve string values, you must pass a ${readableType} definition directly`,
            node.loc
          )
        );
      }
    }

    args = ASTv2.CurlyArgs(
      new ASTv2.PositionalArguments({
        exprs: args.positional.exprs.slice(1),
        loc: args.positional.loc,
      }),
      args.named,
      args.loc
    );

    return Ok({ definition, args });
  };
}

function translateCurryKeyword(curriedType: CurriedType) {
  return (
    { node, keyword, state }: ContentKeywordInfo,
    { definition, args }: { definition: ASTv2.ExpressionValueNode; args: ASTv2.CurlyArgs }
  ): Result<mir.Curry> => {
    let definitionResult = visitExpr(definition, state);
    let argsResult = visitCurlyArgs(args, state);

    return Result.all(definitionResult, argsResult).mapOk(
      ([definition, args]) =>
        new mir.Curry({
          keyword,
          loc: node.loc,
          curriedType,
          definition,
          args,
        })
    );
  };
}

export function curryKeyword(
  curriedType: CurriedType
): KeywordDelegate<
  ContentKeywordMatch,
  { definition: ASTv2.ExpressionValueNode; args: ASTv2.CurlyArgs },
  mir.Curry
> {
  return {
    assert: assertCurryKeyword(curriedType),
    translate: translateCurryKeyword(curriedType),
  };
}
