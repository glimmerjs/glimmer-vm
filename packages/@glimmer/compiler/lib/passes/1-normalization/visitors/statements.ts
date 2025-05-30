import type { ASTv1, ASTv2 } from '@glimmer/syntax';
import { exhausted } from '@glimmer/debug-util';
import { generateSyntaxError, GlimmerSyntaxError } from '@glimmer/syntax';

import type { NormalizationState } from '../context';

import { OptionalList } from '../../../shared/list';
import { Err, Ok, Result, ResultArray } from '../../../shared/result';
import * as mir from '../../2-encoding/mir';
import { BLOCK_KEYWORDS } from '../keywords';
import { APPEND_KEYWORDS } from '../keywords/append';
import { ClassifiedElement, hasDynamicFeatures } from './element/classified';
import { ClassifiedComponent } from './element/component';
import { ClassifiedSimpleElement } from './element/simple-element';
import { visitCurlyArgs, visitExpr, visitHeadExpr } from './expressions';

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
    case 'AppendResolvedContent':
      return visitAppendContent(node, state);
    case 'AppendStaticContent':
      return Ok(visitStaticAppend(node));
    case 'AppendResolvedInvokable':
    case 'AppendInvokable':
      return visitAppendInvokable(node, state);
    case 'HtmlText':
      return Ok(visitTextNode(node));
    case 'HtmlComment':
      return Ok(visitHtmlComment(node));
    case 'InvokeBlock':
    case 'InvokeResolvedBlock':
      return visitInvokeBlock(node, state);
    case 'InvokeAngleBracketComponent':
    case 'InvokeResolvedAngleBracketComponent':
      return visitInvokeAngleBracketComponent(node, state);
    case 'SimpleElement':
      return visitSimpleElement(node, state);
    case 'Error':
      return Err(GlimmerSyntaxError.forErrorNode(node));
    default:
      exhausted(node);
  }
}

export function visitNamedBlock(
  named: ASTv2.NamedBlock | ASTv1.ErrorNode,
  state: NormalizationState
): Result<mir.NamedBlock | ASTv1.ErrorNode> {
  if (named.type === 'Error') {
    return Ok(named);
  }
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

function visitInvokeBlock(
  node: ASTv2.InvokeBlock | ASTv2.InvokeResolvedBlock,
  state: NormalizationState
): Result<mir.Content> {
  let translated = BLOCK_KEYWORDS.translate(node, state);

  if (translated !== null) {
    return translated;
  }

  const args = visitCurlyArgs(node.args, state);
  const blocks = visitNamedBlocks(node.blocks, state);

  if (node.type === 'InvokeResolvedBlock') {
    return Result.all(args, blocks).mapOk(
      ([args, blocks]) =>
        new mir.InvokeResolvedBlockComponent({
          loc: node.loc,
          head: node.resolved,
          args,
          blocks,
        })
    );
  }

  const head = visitExpr(node.callee, state);

  return Result.all(head, args, blocks).andThen(([head, args, blocks]) => {
    if (head.type !== 'PathExpression' && head.type !== 'Lexical') {
      return Err(
        generateSyntaxError(
          `expected a path expression or variable reference, got ${head.type}`,
          head.loc
        )
      );
    }

    return Ok(
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
  element: ASTv2.SimpleElementNode,
  state: NormalizationState
): Result<mir.Content> {
  return new ClassifiedElement(
    element,
    new ClassifiedSimpleElement(element.tag, element, hasDynamicFeatures(element)),
    state
  ).toStatement();
}

function visitInvokeAngleBracketComponent(
  component: ASTv2.InvokeAngleBracketComponent | ASTv2.InvokeResolvedAngleBracketComponent,
  state: NormalizationState
): Result<mir.Content> {
  if (component.type === 'InvokeResolvedAngleBracketComponent') {
    return new ClassifiedElement(
      component,
      new ClassifiedComponent(component.callee, component),
      state
    ).toStatement();
  }

  return visitExpr(component.callee, state).andThen((callee) =>
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

function visitAppendInvokable(
  append: ASTv2.AppendResolvedInvokable | ASTv2.AppendInvokable,
  state: NormalizationState
): Result<mir.Content> {
  if (append.type === 'AppendInvokable') {
    return Result.all(visitExpr(append.callee, state), visitCurlyArgs(append.args, state)).mapOk(
      ([callee, args]) => {
        if (append.trusting) {
          return new mir.AppendTrustingInvokable({
            loc: append.loc,
            callee,
            args,
          });
        } else {
          return new mir.AppendInvokableCautiously({
            loc: append.loc,
            callee,
            args,
          });
        }
      }
    );
  }

  const keyword = APPEND_KEYWORDS.translate(append, state);

  if (keyword) {
    return keyword;
  }

  return visitCurlyArgs(append.args, state).mapOk((args) => {
    if (append.trusting) {
      return new mir.AppendTrustingInvokable({
        loc: append.loc,
        callee: append.resolved,
        args,
      });
    } else {
      return new mir.AppendInvokableCautiously({
        loc: append.loc,
        callee: append.resolved,
        args,
      });
    }
  });
}

function visitAppendContent(
  append: ASTv2.AppendContent | ASTv2.AppendResolvedContent,
  state: NormalizationState
): Result<mir.Content> {
  let translated = APPEND_KEYWORDS.translate(append, state);

  if (translated !== null) {
    return translated;
  }

  if (append.type === 'AppendResolvedContent') {
    if (append.trusting) {
      return Ok(
        new mir.AppendTrustedHTML({
          loc: append.loc,
          value: append.resolved,
        })
      );
    } else {
      return Ok(
        new mir.AppendValueCautiously({
          loc: append.loc,
          value: append.resolved,
        })
      );
    }
  }

  return visitHeadExpr(append.value, state).mapOk((value) => {
    if (append.trusting) {
      return new mir.AppendTrustedHTML({
        loc: append.loc,
        value: value,
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
