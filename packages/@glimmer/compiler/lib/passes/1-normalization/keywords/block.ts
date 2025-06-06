import type { ASTv2 } from '@glimmer/syntax';
import { CURRIED_COMPONENT } from '@glimmer/constants';
import { generateSyntaxError } from '@glimmer/syntax';

import type { NormalizationState } from '../context';

import { Err, Ok, Result } from '../../../shared/result';
import * as mir from '../../2-encoding/mir';
import { VISIT_EXPRS } from '../visitors/expressions';
import { VISIT_STMTS } from '../visitors/statements';
import { keywords } from './impl';
import { assertCurryKeyword } from './utils/curry';

export const BLOCK_KEYWORDS = keywords('Block')
  .kw('in-element', {
    assert(node: ASTv2.InvokeBlock): Result<{
      insertBefore: ASTv2.ExpressionNode | null;
      destination: ASTv2.ExpressionNode;
    }> {
      let { args } = node;

      let guid = args.get('guid');

      if (guid) {
        return Err(generateSyntaxError(`Cannot pass \`guid\` to \`{{#in-element}}\``, guid.loc));
      }

      let insertBefore = args.get('insertBefore');
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

    translate(
      { node, state }: { node: ASTv2.InvokeBlock; state: NormalizationState },
      {
        insertBefore,
        destination,
      }: { insertBefore: ASTv2.ExpressionNode | null; destination: ASTv2.ExpressionNode }
    ): Result<mir.InElement> {
      let named = node.blocks.get('default');
      let body = VISIT_STMTS.NamedBlock(named, state);
      let destinationResult = VISIT_EXPRS.visit(destination, state);

      return Result.all(body, destinationResult)
        .andThen(
          ([body, destination]): Result<{
            body: mir.NamedBlock;
            destination: mir.ExpressionNode;
            insertBefore: mir.ExpressionNode;
          }> => {
            if (insertBefore) {
              return VISIT_EXPRS.visit(insertBefore, state).mapOk((insertBefore) => ({
                body,
                destination,
                insertBefore,
              }));
            } else {
              return Ok({
                body,
                destination,
                insertBefore: new mir.Missing({
                  loc: node.callee.loc.collapse('end'),
                }),
              });
            }
          }
        )
        .mapOk(
          ({ body, destination, insertBefore }) =>
            new mir.InElement({
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
    assert(node: ASTv2.InvokeBlock): Result<{
      condition: ASTv2.ExpressionNode;
    }> {
      let { args } = node;

      if (!args.named.isEmpty()) {
        return Err(
          generateSyntaxError(
            `{{#if}} cannot receive named parameters, received ${args.named.entries
              .map((e) => e.name.chars)
              .join(', ')}`,
            node.loc
          )
        );
      }

      if (args.positional.size > 1) {
        return Err(
          generateSyntaxError(
            `{{#if}} can only receive one positional parameter in block form, the conditional value. Received ${args.positional.size} parameters`,
            node.loc
          )
        );
      }

      let condition = args.nth(0);

      if (condition === null) {
        return Err(
          generateSyntaxError(
            `{{#if}} requires a condition as its first positional parameter, did not receive any parameters`,
            node.loc
          )
        );
      }

      return Ok({ condition });
    },

    translate(
      { node, state }: { node: ASTv2.InvokeBlock; state: NormalizationState },
      { condition }: { condition: ASTv2.ExpressionNode }
    ): Result<mir.If> {
      let block = node.blocks.get('default');
      let inverse = node.blocks.get('else');

      let conditionResult = VISIT_EXPRS.visit(condition, state);
      let blockResult = VISIT_STMTS.NamedBlock(block, state);
      let inverseResult = inverse ? VISIT_STMTS.NamedBlock(inverse, state) : Ok(null);

      return Result.all(conditionResult, blockResult, inverseResult).mapOk(
        ([condition, block, inverse]) =>
          new mir.If({
            loc: node.loc,
            condition,
            block,
            inverse,
          })
      );
    },
  })
  .kw('unless', {
    assert(node: ASTv2.InvokeBlock): Result<{
      condition: ASTv2.ExpressionNode;
    }> {
      let { args } = node;

      if (!args.named.isEmpty()) {
        return Err(
          generateSyntaxError(
            `{{#unless}} cannot receive named parameters, received ${args.named.entries
              .map((e) => e.name.chars)
              .join(', ')}`,
            node.loc
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

    translate(
      { node, state }: { node: ASTv2.InvokeBlock; state: NormalizationState },
      { condition }: { condition: ASTv2.ExpressionNode }
    ): Result<mir.If> {
      let block = node.blocks.get('default');
      let inverse = node.blocks.get('else');

      let conditionResult = VISIT_EXPRS.visit(condition, state);
      let blockResult = VISIT_STMTS.NamedBlock(block, state);
      let inverseResult = inverse ? VISIT_STMTS.NamedBlock(inverse, state) : Ok(null);

      return Result.all(conditionResult, blockResult, inverseResult).mapOk(
        ([condition, block, inverse]) =>
          new mir.If({
            loc: node.loc,
            condition: new mir.Not({ value: condition, loc: node.loc }),
            block,
            inverse,
          })
      );
    },
  })
  .kw('each', {
    assert(node: ASTv2.InvokeBlock): Result<{
      value: ASTv2.ExpressionNode;
      key: ASTv2.ExpressionNode | null;
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
      let key = args.get('key');

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

    translate(
      { node, state }: { node: ASTv2.InvokeBlock; state: NormalizationState },
      { value, key }: { value: ASTv2.ExpressionNode; key: ASTv2.ExpressionNode | null }
    ): Result<mir.Each> {
      let block = node.blocks.get('default');
      let inverse = node.blocks.get('else');

      let valueResult = VISIT_EXPRS.visit(value, state);
      let keyResult = key ? VISIT_EXPRS.visit(key, state) : Ok(null);

      let blockResult = VISIT_STMTS.NamedBlock(block, state);
      let inverseResult = inverse ? VISIT_STMTS.NamedBlock(inverse, state) : Ok(null);

      return Result.all(valueResult, keyResult, blockResult, inverseResult).mapOk(
        ([value, key, block, inverse]) =>
          new mir.Each({
            loc: node.loc,
            value,
            key,
            block,
            inverse,
          })
      );
    },
  })
  .kw('let', {
    assert(node: ASTv2.InvokeBlock): Result<{
      positional: ASTv2.PositionalArguments;
    }> {
      let { args } = node;

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

      if (args.positional.size === 0) {
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

      return Ok({ positional: args.positional });
    },

    translate(
      { node, state }: { node: ASTv2.InvokeBlock; state: NormalizationState },
      { positional }: { positional: ASTv2.PositionalArguments }
    ): Result<mir.Let> {
      let block = node.blocks.get('default');

      let positionalResult = VISIT_EXPRS.Positional(positional, state);
      let blockResult = VISIT_STMTS.NamedBlock(block, state);

      return Result.all(positionalResult, blockResult).mapOk(
        ([positional, block]) =>
          new mir.Let({
            loc: node.loc,
            positional,
            block,
          })
      );
    },
  })
  .kw('-with-dynamic-vars', {
    assert(node: ASTv2.InvokeBlock): Result<{
      named: ASTv2.NamedArguments;
    }> {
      return Ok({ named: node.args.named });
    },

    translate(
      { node, state }: { node: ASTv2.InvokeBlock; state: NormalizationState },
      { named }: { named: ASTv2.NamedArguments }
    ): Result<mir.WithDynamicVars> {
      let block = node.blocks.get('default');

      let namedResult = VISIT_EXPRS.NamedArguments(named, state);
      let blockResult = VISIT_STMTS.NamedBlock(block, state);

      return Result.all(namedResult, blockResult).mapOk(
        ([named, block]) =>
          new mir.WithDynamicVars({
            loc: node.loc,
            named,
            block,
          })
      );
    },
  })
  .kw('component', {
    assert: assertCurryKeyword(CURRIED_COMPONENT),

    translate(
      { node, state }: { node: ASTv2.InvokeBlock; state: NormalizationState },
      { definition, args }: { definition: ASTv2.ExpressionNode; args: ASTv2.Args }
    ): Result<mir.InvokeComponent> {
      let definitionResult = VISIT_EXPRS.visit(definition, state);
      let argsResult = VISIT_EXPRS.Args(args, state);
      let blocksResult = VISIT_STMTS.NamedBlocks(node.blocks, state);

      return Result.all(definitionResult, argsResult, blocksResult).mapOk(
        ([definition, args, blocks]) =>
          new mir.InvokeComponent({
            loc: node.loc,
            definition,
            args,
            blocks,
          })
      );
    },
  });
