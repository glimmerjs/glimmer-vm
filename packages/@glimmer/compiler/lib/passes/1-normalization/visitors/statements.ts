import { ASTv2 } from '@glimmer/syntax';
import { OptionalList } from '../../../shared/list';
import { Ok, Result, ResultArray } from '../../../shared/result';
import * as hir from '../../2-symbol-allocation/hir';
import { NormalizationUtilities } from '../context';
import { BLOCK_KEYWORDS } from '../keywords';
import { APPEND_KEYWORDS } from '../keywords/append';
import { ClassifiedElement, hasDynamicFeatures } from './element/classified';
import { ClassifiedComponent } from './element/component';
import { ClassifiedSimpleElement } from './element/simple-element';
import { VISIT_EXPRS } from './expressions';

// Whitespace is allowed around and between named blocks
const WHITESPACE = /^\s+$/;

class NormalizationStatements {
  visitList(
    nodes: readonly ASTv2.ContentNode[],
    utils: NormalizationUtilities
  ): Result<OptionalList<hir.Statement>> {
    return new ResultArray(nodes.map((e) => VISIT_STMTS.visit(e, utils)))
      .toOptionalList()
      .mapOk((list) => list.filter((s: hir.Statement | null): s is hir.Statement => s !== null));
  }

  visit(node: ASTv2.ContentNode, utils: NormalizationUtilities): Result<hir.Statement | null> {
    switch (node.type) {
      case 'GlimmerComment':
        return Ok(null);
      case 'AppendContent':
        return this.AppendContent(node, utils);
      case 'HtmlComment':
        return Ok(this.HtmlComment(node, utils));
      case 'InvokeBlock':
        return this.InvokeBlock(node, utils);
      case 'InvokeComponent':
        return this.Component(node, utils);
      case 'SimpleElement':
        return this.SimpleElement(node, utils);
      case 'HtmlText':
        return Ok(this.TextNode(node, utils));
    }
  }

  InvokeBlock(node: ASTv2.InvokeBlock, utils: NormalizationUtilities): Result<hir.Statement> {
    let translated = BLOCK_KEYWORDS.translate(node, utils);

    if (translated !== null) {
      return translated;
    }

    let head = VISIT_EXPRS.visit(node.callee, utils);
    let args = VISIT_EXPRS.Args(node.args, utils);

    return Result.all(head, args).andThen(([head, args]) =>
      this.NamedBlocks(node.blocks, utils).mapOk((blocks) =>
        utils
          .op(hir.BlockInvocation, {
            head,
            args,
            blocks,
          })
          .loc(node)
      )
    );
  }

  NamedBlocks(blocks: ASTv2.NamedBlocks, utils: NormalizationUtilities): Result<hir.NamedBlocks> {
    let list = new ResultArray(blocks.blocks.map((b) => this.NamedBlock(b, utils)));

    return list
      .toArray()
      .mapOk((list) => utils.op(hir.NamedBlocks, { blocks: OptionalList(list) }).loc(blocks));
  }

  NamedBlock(named: ASTv2.NamedBlock, utils: NormalizationUtilities): Result<hir.NamedBlock> {
    let body = VISIT_STMTS.visitList(named.block.body, utils);

    return body.mapOk((body) => {
      return utils
        .op(hir.NamedBlock, { name: named.name, body: body.toArray(), table: named.block.table })
        .loc(named);
    });
  }

  SimpleElement(
    element: ASTv2.SimpleElement,
    utils: NormalizationUtilities
  ): Result<hir.Statement> {
    return new ClassifiedElement(
      element,
      new ClassifiedSimpleElement(element.tag, element, hasDynamicFeatures(element)),
      utils
    ).toStatement();
  }

  Component(
    component: ASTv2.InvokeComponent,
    utils: NormalizationUtilities
  ): Result<hir.Statement> {
    return VISIT_EXPRS.visit(component.callee, utils).andThen((callee) =>
      new ClassifiedElement(
        component,
        new ClassifiedComponent(callee, component),
        utils
      ).toStatement()
    );
  }

  AppendContent(append: ASTv2.AppendContent, utils: NormalizationUtilities): Result<hir.Statement> {
    let translated = APPEND_KEYWORDS.translate(append, utils);

    if (translated !== null) {
      return translated;
    }

    let value = VISIT_EXPRS.visit(append.value, utils);

    return value.mapOk((value) => {
      if (append.trusting) {
        return utils
          .op(hir.AppendTrustedHTML, {
            value,
          })
          .loc(append);
      } else {
        return utils
          .op(hir.AppendTextNode, {
            value,
          })
          .loc(append);
      }
    });
  }

  TextNode(text: ASTv2.HtmlText, utils: NormalizationUtilities): hir.Statement {
    if (WHITESPACE.exec(text.chars)) {
      return utils.op(hir.AppendWhitespace, { value: text.chars }).loc(text);
    } else {
      return utils
        .op(hir.AppendTextNode, {
          value: utils.op(hir.Literal, { value: text.chars }).loc(text),
        })
        .loc(text);
    }
  }

  HtmlComment(comment: ASTv2.HtmlComment, utils: NormalizationUtilities): hir.Statement {
    return utils
      .op(hir.AppendComment, {
        value: comment.text,
      })
      .loc(comment);
  }
}

export const VISIT_STMTS = new NormalizationStatements();
