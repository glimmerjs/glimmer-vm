import { type ASTv2, generateSyntaxError } from '@glimmer/syntax';

import { Err as Error_, Ok, Result } from '../../../shared/result';
import * as mir from '../../2-encoding/mir';
import type { NormalizationState } from '../context';
import { VISIT_EXPRS } from '../visitors/expressions';
import { VISIT_STMTS } from '../visitors/statements';
import { keywords } from './impl';
import { assertCurryKeyword } from './utils/curry';
import { CURRIED_COMPONENT } from '@glimmer/vm-constants';

export const BLOCK_KEYWORDS = keywords('Block')
  .kw('in-element', {
    assert(node: ASTv2.InvokeBlock): Result<{
      insertBefore: ASTv2.ExpressionNode | null;
      destination: ASTv2.ExpressionNode;
    }> {
      let { args } = node;

      let guid = args.get('guid');

      if (guid) {
        return Error_(generateSyntaxError(`Cannot pass \`guid\` to \`{{#in-element}}\``, guid.loc));
      }

      let insertBefore = args.get('insertBefore');
      let destination = args.nth(0);

      if (destination === null) {
        return Error_(
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
            return insertBefore
              ? VISIT_EXPRS.visit(insertBefore, state).mapOk((insertBefore) => ({
                  body,
                  destination,
                  insertBefore,
                }))
              : Ok({
                  body,
                  destination,
                  insertBefore: mir.Missing.of({
                    loc: node.callee.loc.collapse('end'),
                  }),
                });
          }
        )
        .mapOk(({ body, destination, insertBefore }) =>
          mir.InElement.of({
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
        return Error_(
          generateSyntaxError(
            `{{#if}} cannot receive named parameters, received ${args.named.entries
              .map((e) => e.name.chars)
              .join(', ')}`,
            node.loc
          )
        );
      }

      if (args.positional.size > 1) {
        return Error_(
          generateSyntaxError(
            `{{#if}} can only receive one positional parameter in block form, the conditional value. Received ${args.positional.size} parameters`,
            node.loc
          )
        );
      }

      let condition = args.nth(0);

      if (condition === null) {
        return Error_(
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
          mir.If.of({
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
        return Error_(
          generateSyntaxError(
            `{{#unless}} cannot receive named parameters, received ${args.named.entries
              .map((e) => e.name.chars)
              .join(', ')}`,
            node.loc
          )
        );
      }

      if (args.positional.size > 1) {
        return Error_(
          generateSyntaxError(
            `{{#unless}} can only receive one positional parameter in block form, the conditional value. Received ${args.positional.size} parameters`,
            node.loc
          )
        );
      }

      let condition = args.nth(0);

      if (condition === null) {
        return Error_(
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
          mir.If.of({
            loc: node.loc,
            condition: mir.Not.of({ value: condition, loc: node.loc }),
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
        return Error_(
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
        return Error_(
          generateSyntaxError(
            `{{#each}} can only receive one positional parameter, the collection being iterated. Received ${args.positional.size} parameters`,
            args.positional.loc
          )
        );
      }

      let value = args.nth(0);
      let key = args.get('key');

      if (value === null) {
        return Error_(
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
          mir.Each.of({
            loc: node.loc,
            value,
            key,
            block,
            inverse,
          })
      );
    },
  })
  .kw('with', {
    assert(node: ASTv2.InvokeBlock): Result<{
      value: ASTv2.ExpressionNode;
    }> {
      let { args } = node;

      if (!args.named.isEmpty()) {
        return Error_(
          generateSyntaxError(
            `{{#with}} cannot receive named parameters, received ${args.named.entries
              .map((e) => e.name.chars)
              .join(', ')}`,
            args.named.loc
          )
        );
      }

      if (args.positional.size > 1) {
        return Error_(
          generateSyntaxError(
            `{{#with}} can only receive one positional parameter. Received ${args.positional.size} parameters`,
            args.positional.loc
          )
        );
      }

      let value = args.nth(0);

      if (value === null) {
        return Error_(
          generateSyntaxError(
            `{{#with}} requires a value as its first positional parameter, did not receive any parameters`,
            args.loc
          )
        );
      }

      return Ok({ value });
    },

    translate(
      { node, state }: { node: ASTv2.InvokeBlock; state: NormalizationState },
      { value }: { value: ASTv2.ExpressionNode }
    ): Result<mir.With> {
      let block = node.blocks.get('default');
      let inverse = node.blocks.get('else');

      let valueResult = VISIT_EXPRS.visit(value, state);
      let blockResult = VISIT_STMTS.NamedBlock(block, state);
      let inverseResult = inverse ? VISIT_STMTS.NamedBlock(inverse, state) : Ok(null);

      return Result.all(valueResult, blockResult, inverseResult).mapOk(([value, block, inverse]) =>
        mir.With.of({
          loc: node.loc,
          value,
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
        return Error_(
          generateSyntaxError(
            `{{#let}} cannot receive named parameters, received ${args.named.entries
              .map((e) => e.name.chars)
              .join(', ')}`,
            args.named.loc
          )
        );
      }

      if (args.positional.size === 0) {
        return Error_(
          generateSyntaxError(
            `{{#let}} requires at least one value as its first positional parameter, did not receive any parameters`,
            args.positional.loc
          )
        );
      }

      if (node.blocks.get('else')) {
        return Error_(
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

      return Result.all(positionalResult, blockResult).mapOk(([positional, block]) =>
        mir.Let.of({
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

      return Result.all(namedResult, blockResult).mapOk(([named, block]) =>
        mir.WithDynamicVars.of({
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
          mir.InvokeComponent.of({
            loc: node.loc,
            definition,
            args,
            blocks,
          })
      );
    },
  });
