import { CURRIED_COMPONENT, CURRIED_HELPER } from '@glimmer/constants';
import { ASTv2, generateSyntaxError, src } from '@glimmer/syntax';

import { Err, Ok, Result } from '../../../shared/result';
import * as mir from '../../2-encoding/mir';
import { visitCurlyArgs, visitExpr, visitPositional } from '../visitors/expressions';
import { keywords } from './impl';
import { toAppend } from './utils/call-or-append';
import { assertCurryKeyword } from './utils/curry';
import { getDynamicVarKeyword } from './utils/dynamic-vars';
import { hasBlockKeyword } from './utils/has-block';
import { ifUnlessInlineKeyword } from './utils/if-unless';
import { logKeyword } from './utils/log';

export const APPEND_KEYWORDS = keywords('Append')
  .kw('has-block', toAppend(hasBlockKeyword('has-block')))
  .kw('has-block-params', toAppend(hasBlockKeyword('has-block-params')))
  .kw('-get-dynamic-var', toAppend(getDynamicVarKeyword))
  .kw('log', toAppend(logKeyword))
  .kw('if', toAppend(ifUnlessInlineKeyword('if')))
  .kw('unless', toAppend(ifUnlessInlineKeyword('unless')))
  .kw('yield', {
    assert({ args }): Result<{
      target: src.SourceSlice;
      positional: ASTv2.PositionalArguments;
    }> {
      if (args.named.isEmpty()) {
        return Ok({
          target: src.SourceSpan.synthetic('default').toSlice(),
          positional: args.positional,
        });
      } else {
        let target = args.named.get('to');

        if (args.named.size > 1 || target === null) {
          return Err(
            generateSyntaxError(`yield only takes a single named argument: 'to'`, args.named.loc)
          );
        }

        if (ASTv2.isLiteral(target, 'string')) {
          return Ok({ target: target.toSlice(), positional: args.positional });
        } else {
          return Err(
            generateSyntaxError(`you can only yield to a literal string value`, target.loc)
          );
        }
      }
    },

    translate({ node, keyword, state }, { target, positional }): Result<mir.Content> {
      return visitPositional(positional, state).mapOk(
        (positional) =>
          new mir.Yield({
            keyword,
            loc: node.loc,
            target,
            to: state.scope.allocateBlock(target.chars),
            positional,
          })
      );
    },
  })
  .kw('debugger', {
    assert({ node, args }): Result<void> {
      let { positional } = args;

      if (args.isEmpty()) {
        return Ok(undefined);
      } else {
        if (positional.isEmpty()) {
          return Err(generateSyntaxError(`debugger does not take any named arguments`, node.loc));
        } else {
          return Err(
            generateSyntaxError(`debugger does not take any positional arguments`, node.loc)
          );
        }
      }
    },

    translate({ node, keyword, state: { scope } }): Result<mir.Content> {
      return Ok(new mir.Debugger({ keyword, loc: node.loc, scope }));
    },
  })
  .kw('component', {
    assert: assertCurryKeyword(CURRIED_COMPONENT),

    translate(
      { node, keyword, state },
      { definition, args }
    ): Result<mir.InvokeComponentKeyword | mir.InvokeResolvedComponentKeyword> {
      let definitionResult = visitExpr(definition, state);
      let argsResult = visitCurlyArgs(args, state);

      return Result.all(definitionResult, argsResult).andThen(([definition, args]) => {
        if (definition.type === 'Literal') {
          if (typeof definition.value !== 'string') {
            return Err(
              generateSyntaxError(
                `Expected literal component name to be a string, but received ${definition.value}`,
                definition.loc
              )
            );
          }

          return Ok(
            new mir.InvokeResolvedComponentKeyword({
              keyword,
              loc: node.loc,
              definition: definition.value,
              args,
            })
          );
        }

        return Ok(
          new mir.InvokeComponentKeyword({
            keyword,
            loc: node.loc,
            definition,
            args,
          })
        );
      });
    },
  })
  .kw('helper', {
    assert: assertCurryKeyword(CURRIED_HELPER),

    translate({ node, state }, { definition, args }): Result<mir.AppendValueCautiously> {
      let definitionResult = visitExpr(definition, state);
      let argsResult = visitCurlyArgs(args, state);

      return Result.all(definitionResult, argsResult).mapOk(([definition, args]) => {
        let value = new mir.CallExpression({ callee: definition, args, loc: node.loc });

        return new mir.AppendValueCautiously({
          loc: node.loc,
          value,
        });
      });
    },
  });
