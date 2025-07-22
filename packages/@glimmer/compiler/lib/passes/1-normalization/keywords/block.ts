import type { ASTv2 } from '@glimmer/syntax';
import { CURRIED_COMPONENT } from '@glimmer/constants';
import { generateSyntaxError, GlimmerSyntaxError } from '@glimmer/syntax';

import { createNormalizationView } from '../../../shared/post-validation-view';
import { Err, Ok, Result } from '../../../shared/result';
import * as mir from '../../2-encoding/mir';
import {
  visitCurlyArgs,
  visitCurlyNamedArguments,
  visitExpr,
  visitPositional,
} from '../visitors/expressions';
import { visitNamedBlock, visitNamedBlocks } from '../visitors/statements';
import { keywords } from './impl';
import { assertCurryKeyword } from './utils/curry';

const view = createNormalizationView();

export const BLOCK_KEYWORDS = keywords('Block')
  .kw('in-element', {
    assert(node): Result<{
      insertBefore: ASTv2.CurlyArgument | null;
      destination: ASTv2.ExpressionValueNode;
    }> {
      let { args } = node;

      let guid = args.get('guid');

      if (guid) {
        return Err(generateSyntaxError(`Cannot pass \`guid\` to \`{{#in-element}}\``, guid.loc));
      }

      let insertBefore = args.getNode('insertBefore');
      let destination = args.nth(0);

      if (destination === null) {
        return Err(
          generateSyntaxError(
            `{{#in-element}} requires a target element as its first positional parameter`,
            args.loc
          )
        );
      }

      // TODO Better syntax checks

      return Ok({ insertBefore, destination });
    },

    translate({ node, keyword, state }, { insertBefore, destination }): Result<mir.InElement> {
      let named = node.blocks.get('default');
      let body = visitNamedBlock(named, state);
      let destinationResult = visitExpr(destination, state);

      return Result.all(body, destinationResult)
        .andThen(
          ([body, destination]): Result<{
            body: mir.NamedBlock;
            destination: mir.ExpressionValueNode;
            insertBefore: mir.CustomNamedArgument<mir.ExpressionValueNode> | mir.Missing;
          }> => {
            // Handle ErrorNode case
            if (body.type === 'Error') {
              return Err(generateSyntaxError('Invalid block body', body.loc));
            }

            if (insertBefore) {
              return visitExpr(insertBefore.value, state).mapOk((insertBeforeValue) => ({
                body: body,
                destination,
                insertBefore: mir.CustomNamedArgument.from(insertBefore, insertBeforeValue),
              }));
            } else {
              return Ok({
                body: body,
                destination,
                insertBefore: new mir.Missing({
                  loc: node.resolved.loc.collapse('end'),
                }),
              });
            }
          }
        )
        .mapOk(
          ({ body, destination, insertBefore }) =>
            new mir.InElement({
              keyword,
              loc: node.loc,
              block: body,
              insertBefore,
              guid: state.generateUniqueCursor(),
              destination,
            })
        );
    },
  })
  .kw('if', {
    assert(node): Result<{
      condition: ASTv2.ExpressionValueNode;
    }> {
      let { args } = node;

      if (!args.named.isEmpty()) {
        return Err(
          GlimmerSyntaxError.highlight(
            `{{#if}} cannot receive named parameters, received ${args.named.entries
              .map((e) => `\`${e.name.chars}\``)
              .join(', ')}`,
            args.named.loc
              .highlight()
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              .withPrimary(args.named.entries[0]!.name.loc.highlight('invalid'))
          )
        );
      }

      const [, second, ...rest] = args.positional.exprs;

      if (second) {
        return Err(
          GlimmerSyntaxError.highlight(
            `{{#if}} can only receive one positional parameter in block form, the conditional value. Received ${args.positional.size} parameters`,
            args.positional.loc
              .highlight('positional arguments')
              .withPrimary(
                second.loc
                  .withEnd(args.positional.loc.getEnd())
                  .highlight(rest.length === 0 ? 'extra argument' : 'extra arguments')
              )
          )
        );
      }

      let condition = args.nth(0);

      if (condition === null) {
        return Err(
          generateSyntaxError(
            `{{#if}} requires a condition as its first positional parameter, did not receive any parameters`,
            node.keyword.loc.highlight('missing condition')
          )
        );
      }

      return Ok({ condition });
    },

    translate({ node, keyword, state }, { condition }): Result<mir.IfContent> {
      let block = node.blocks.get('default');
      let inverse = node.blocks.get('else');

      let conditionResult = visitExpr(condition, state);
      let blockResult = visitNamedBlock(block, state);
      let inverseResult = inverse ? visitNamedBlock(inverse, state) : Ok(null);

      return Result.all(conditionResult, blockResult, inverseResult).mapOk(
        ([condition, block, inverse]) =>
          new mir.IfContent({
            keyword,
            loc: node.loc,
            condition,
            block: view.get(block, 'named block'),
            inverse: inverse ? view.get(inverse, 'named block') : null,
          })
      );
    },
  })
  .kw('unless', {
    assert(node): Result<{
      condition: ASTv2.ExpressionValueNode;
    }> {
      let { args } = node;

      if (!args.named.isEmpty()) {
        return Err(
          GlimmerSyntaxError.highlight(
            `{{#unless}} cannot receive named parameters, received ${args.named.entries
              .map((e) => `\`${e.name.chars}\``)
              .join(', ')}`,
            args.named.loc
              .highlight()
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              .withPrimary(args.named.entries[0]!.name.loc.highlight('invalid'))
          )
        );
      }

      if (args.positional.size > 1) {
        return Err(
          generateSyntaxError(
            `{{#unless}} can only receive one positional parameter in block form, the conditional value. Received ${args.positional.size} parameters`,
            node.loc
          )
        );
      }

      let condition = args.nth(0);

      if (condition === null) {
        return Err(
          generateSyntaxError(
            `{{#unless}} requires a condition as its first positional parameter, did not receive any parameters`,
            node.loc
          )
        );
      }

      return Ok({ condition });
    },

    translate({ node, keyword, state }, { condition }): Result<mir.IfContent> {
      let block = node.blocks.get('default');
      let inverse = node.blocks.get('else');

      let conditionResult = visitExpr(condition, state);
      let blockResult = visitNamedBlock(block, state);
      let inverseResult = inverse ? visitNamedBlock(inverse, state) : Ok(null);

      return Result.all(conditionResult, blockResult, inverseResult).mapOk(
        ([condition, block, inverse]) =>
          new mir.IfContent({
            keyword,
            loc: node.loc,
            condition: new mir.Not({ keyword, value: condition, loc: node.loc }),
            block: view.get(block, 'named block'),
            inverse: inverse ? view.get(inverse, 'named block') : null,
          })
      );
    },
  })
  .kw('each', {
    assert(node): Result<{
      value: ASTv2.ExpressionValueNode;
      key: ASTv2.CurlyArgument | null;
    }> {
      let { args } = node;

      if (!args.named.entries.every((e) => e.name.chars === 'key')) {
        return Err(
          generateSyntaxError(
            `{{#each}} can only receive the 'key' named parameter, received ${args.named.entries
              .filter((e) => e.name.chars !== 'key')
              .map((e) => e.name.chars)
              .join(', ')}`,
            args.named.loc
          )
        );
      }

      if (args.positional.size > 1) {
        return Err(
          generateSyntaxError(
            `{{#each}} can only receive one positional parameter, the collection being iterated. Received ${args.positional.size} parameters`,
            args.positional.loc
          )
        );
      }

      let value = args.nth(0);
      let key = args.getNode('key');

      if (value === null) {
        return Err(
          generateSyntaxError(
            `{{#each}} requires an iterable value to be passed as its first positional parameter, did not receive any parameters`,
            args.loc
          )
        );
      }

      return Ok({ value, key });
    },

    translate({ node, keyword, state }, { value, key }): Result<mir.Each> {
      let block = node.blocks.get('default');
      let inverse = node.blocks.get('else');

      let valueResult = visitExpr(value, state);
      let keyResult = key ? visitExpr(key.value, state) : Ok(null);

      let blockResult = visitNamedBlock(block, state);
      let inverseResult = inverse ? visitNamedBlock(inverse, state) : Ok(null);

      return Result.all(valueResult, keyResult, blockResult, inverseResult).mapOk(
        ([value, keyExpr, block, inverse]) =>
          new mir.Each({
            keyword,
            loc: node.loc,
            value,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            key: keyExpr ? mir.CustomNamedArgument.from(key!, keyExpr) : null,
            block: view.get(block, 'named block'),
            inverse: inverse ? view.get(inverse, 'named block') : null,
          })
      );
    },
  })
  .kw('let', {
    assert({ node, args }): Result<{
      positional: ASTv2.PresentPositional;
    }> {
      if (!args.named.isEmpty()) {
        return Err(
          generateSyntaxError(
            `{{#let}} cannot receive named parameters, received ${args.named.entries
              .map((e) => e.name.chars)
              .join(', ')}`,
            args.named.loc
          )
        );
      }

      const positional = args.positional.asPresent();

      if (!positional) {
        return Err(
          generateSyntaxError(
            `{{#let}} requires at least one value as its first positional parameter, did not receive any parameters`,
            args.positional.loc
          )
        );
      }

      if (node.blocks.get('else')) {
        return Err(
          generateSyntaxError(`{{#let}} cannot receive an {{else}} block`, args.positional.loc)
        );
      }

      return Ok({ positional });
    },

    translate({ node, keyword, state }, { positional }): Result<mir.Let> {
      let block = node.blocks.get('default');

      let positionalResult = visitPositional(positional, state);
      let blockResult = visitNamedBlock(block, state);

      return Result.all(positionalResult, blockResult).mapOk(
        ([positional, block]) =>
          new mir.Let({
            keyword,
            loc: node.loc,
            positional,
            block: view.get(block, 'named block'),
          })
      );
    },
  })
  .kw('-with-dynamic-vars', {
    assert(node): Result<{
      named: ASTv2.PresentCurlyNamedArguments;
    }> {
      const named = node.args.named.asPresent();

      if (named) {
        return Ok({ named });
      } else {
        return Err(generateSyntaxError(`(-with-dynamic-vars) requires named arguments`, node.loc));
      }
    },

    translate({ node, keyword, state }, { named }): Result<mir.WithDynamicVars> {
      let block = node.blocks.get('default');

      let namedResult = visitCurlyNamedArguments(named, state);
      let blockResult = visitNamedBlock(block, state);

      return Result.all(namedResult, blockResult).mapOk(
        ([named, block]) =>
          new mir.WithDynamicVars({
            keyword,
            loc: node.loc,
            named,
            block: view.get(block, 'named block'),
          })
      );
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
      let blocksResult = visitNamedBlocks(node.blocks, state);

      return Result.all(definitionResult, argsResult, blocksResult).andThen(
        ([definition, args, blocks]) => {
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
                blocks,
              })
            );
          }

          return Ok(
            new mir.InvokeComponentKeyword({
              keyword,
              loc: node.loc,
              definition,
              args,
              blocks,
            })
          );
        }
      );
    },
  });
