import type { ASTv2 } from '@glimmer/syntax';
import { generateSyntaxError } from '@glimmer/syntax';

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

export function visitContentList(
  nodes: readonly ASTv2.ContentNode[],
  state: NormalizationState
): Result<OptionalList<mir.Content>> {
  return new ResultArray(nodes.map((e) => visitContent(e, state)))
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

function visitContent(
  node: ASTv2.ContentNode,
  state: NormalizationState
): Result<mir.Content | null> {
  switch (node.type) {
    case 'GlimmerComment':
      return Ok(null);
    case 'AppendContent':
      return visitAppendContent(node, state);
    case 'AppendStaticContent':
      return Ok(visitStaticAppend(node));
    case 'AppendResolvedInvokable':
      return visitAppendResolvedInvokable(node, state);
    case 'HtmlText':
      return Ok(visitTextNode(node));
    case 'HtmlComment':
      return Ok(visitHtmlComment(node));
    case 'InvokeBlock':
      return visitInvokeBlock(node, state);
    case 'InvokeAngleBracketComponent':
      return visitInvokeAngleBracketComponent(node, state);
    case 'SimpleElement':
      return visitSimpleElement(node, state);
  }
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

function visitInvokeBlock(node: ASTv2.InvokeBlock, state: NormalizationState): Result<mir.Content> {
  let translated = BLOCK_KEYWORDS.translate(node, state);

  if (translated !== null) {
    return translated;
  }

  let head =
    node.callee.type === 'ResolvedComponentCallee'
      ? Ok(node.callee)
      : visitExpr(node.callee, state);
  let args = visitArgs(node.args, state);

  return Result.all(head, args).andThen(([head, args]) => {
    if (head.type !== 'PathExpression' && head.type !== 'ResolvedComponentCallee') {
      return Err(
        generateSyntaxError(
          `expected a path expression or variable reference, got ${head.type}`,
          head.loc
        )
      );
    }

    return visitNamedBlocks(node.blocks, state).mapOk(
      (blocks) =>
        new mir.InvokeBlockComponent({
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

function visitInvokeAngleBracketComponent(
  component: ASTv2.InvokeAngleBracketComponent,
  state: NormalizationState
): Result<mir.Content> {
  const { callee } = component;

  if (callee.type === 'ResolvedComponentCallee') {
    return new ClassifiedElement(
      component,
      new ClassifiedComponent(callee, component),
      state
    ).toStatement();
  }

  return visitExpr(callee, state).andThen((callee) =>
    new ClassifiedElement(
      component,
      new ClassifiedComponent(callee, component),
      state
    ).toStatement()
  );
}

function visitStaticAppend(append: ASTv2.AppendStaticContent): mir.AppendStaticContent {
  return new mir.AppendStaticContent({
    loc: append.loc,
    value: append.value,
  });
}

function visitAppendResolvedInvokable(
  append: ASTv2.AppendResolvedInvokable,
  state: NormalizationState
): Result<mir.AppendResolvedInvokableCautiously | mir.AppendTrustingResolvedInvokable> {
  const keyword = APPEND_KEYWORDS.translate(append, state);

  if (keyword) {
    return keyword;
  }

  return visitArgs(append.args, state).mapOk((args) => {
    if (append.trusting) {
      return new mir.AppendTrustingResolvedInvokable({
        loc: append.loc,
        callee: append.callee,
        args,
      });
    } else {
      debugger;
      return new mir.AppendResolvedInvokableCautiously({
        loc: append.loc,
        callee: append.callee,
        args,
      });
    }
  });
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
      return new mir.AppendValueCautiously({
        loc: append.loc,
        value,
      });
    }
  });
}

function visitTextNode(text: ASTv2.HtmlText): mir.Content {
  return new mir.AppendHtmlText({
    loc: text.loc,
    value: text.chars,
  });
}

function visitHtmlComment(comment: ASTv2.HtmlComment): mir.Content {
  return new mir.AppendHtmlComment({
    loc: comment.loc,
    value: comment.text,
  });
}
