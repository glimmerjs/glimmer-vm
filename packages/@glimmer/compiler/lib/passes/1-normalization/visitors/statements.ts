import { ASTv2, generateSyntaxError } from '@glimmer/syntax';

import type { NormalizationState } from '../context';

import { OptionalList } from '../../../shared/list';
import { Err, Ok, Result, ResultArray } from '../../../shared/result';
import * as mir from '../../2-encoding/mir';
import { BLOCK_KEYWORDS } from '../keywords';
import { APPEND_KEYWORDS } from '../keywords/append';
import { ClassifiedElement, hasDynamicFeatures } from './element/classified';
import { ClassifiedComponent } from './element/component';
import { ClassifiedSimpleElement } from './element/simple-element';
import { visitArgs, visitExpr } from './expressions';

export function visitStatements(
  nodes: readonly ASTv2.ContentNode[],
  state: NormalizationState
): Result<OptionalList<mir.Content>> {
  return new ResultArray(nodes.map((e) => visit(e, state)))
    .toOptionalList()
    .mapOk((list) => list.filter((s: mir.Content | null): s is mir.Content => s !== null));
}

export function visitNamedBlocks(
  blocks: ASTv2.NamedBlocks,
  state: NormalizationState
): Result<mir.NamedBlocks> {
  let list = new ResultArray(blocks.blocks.map((b) => visitNamedBlock(b, state)));

  return list
    .toArray()
    .mapOk((list) => new mir.NamedBlocks({ loc: blocks.loc, blocks: OptionalList(list) }));
}

export function visitNamedBlock(
  named: ASTv2.NamedBlock,
  state: NormalizationState
): Result<mir.NamedBlock> {
  let body = state.visitBlock(named.block);

  return body.mapOk((body) => {
    return new mir.NamedBlock({
      loc: named.loc,
      name: named.name,
      body: body.toArray(),
      scope: named.block.scope,
    });
  });
}

function visit(node: ASTv2.ContentNode, state: NormalizationState): Result<mir.Content | null> {
  switch (node.type) {
    case 'GlimmerComment':
      return Ok(null);
    case 'AppendContent':
      return visitAppendContent(node, state);
    case 'HtmlText':
      return Ok(visitTextNode(node));
    case 'HtmlComment':
      return Ok(visitHtmlComment(node));
    case 'InvokeBlock':
      return visitInvokeBlock(node, state);
    case 'InvokeComponent':
      return visitInvokeComponent(node, state);
    case 'SimpleElement':
      return visitSimpleElement(node, state);
  }
}

function visitInvokeBlock(node: ASTv2.InvokeBlock, state: NormalizationState): Result<mir.Content> {
  let translated = BLOCK_KEYWORDS.translate(node, state);

  if (translated !== null) {
    return translated;
  }

  let head = visitExpr(node.callee, state);
  let args = visitArgs(node.args, state);

  return Result.all(head, args).andThen(([head, args]) => {
    if (head.type !== 'PathExpression' && !ASTv2.isVariableReference(head)) {
      return Err(
        generateSyntaxError(
          `expected a path expression or variable reference, got ${head.type}`,
          head.loc
        )
      );
    }

    return visitNamedBlocks(node.blocks, state).mapOk(
      (blocks) =>
        new mir.InvokeBlock({
          loc: node.loc,
          head,
          args,
          blocks,
        })
    );
  });
}

function visitSimpleElement(
  element: ASTv2.SimpleElement,
  state: NormalizationState
): Result<mir.Content> {
  return new ClassifiedElement(
    element,
    new ClassifiedSimpleElement(element.tag, element, hasDynamicFeatures(element)),
    state
  ).toStatement();
}

function visitInvokeComponent(
  component: ASTv2.InvokeComponent,
  state: NormalizationState
): Result<mir.Content> {
  return visitExpr(component.callee, state).andThen((callee) =>
    new ClassifiedElement(
      component,
      new ClassifiedComponent(callee, component),
      state
    ).toStatement()
  );
}

function visitAppendContent(
  append: ASTv2.AppendContent,
  state: NormalizationState
): Result<mir.Content> {
  let translated = APPEND_KEYWORDS.translate(append, state);

  if (translated !== null) {
    return translated;
  }

  let value = visitExpr(append.value, state);

  return value.mapOk((value) => {
    if (append.trusting) {
      return new mir.AppendTrustedHTML({
        loc: append.loc,
        html: value,
      });
    } else {
      return new mir.AppendValue({
        loc: append.loc,
        value: value,
      });
    }
  });
}

function visitTextNode(text: ASTv2.HtmlText): mir.Content {
  return new mir.AppendValue({
    loc: text.loc,
    value: new ASTv2.LiteralExpression({ loc: text.loc, value: text.chars }),
  });
}

function visitHtmlComment(comment: ASTv2.HtmlComment): mir.Content {
  return new mir.AppendHtmlComment({
    loc: comment.loc,
    value: comment.text,
  });
}
