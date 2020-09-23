import { ASTv2 } from '@glimmer/syntax';
import { OptionalList } from '../../../shared/list';
import { Ok, Result, ResultArray } from '../../../shared/result';
import * as hir from '../../2-symbol-allocation/hir';
import { NormalizationState } from '../context';
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
    state: NormalizationState
  ): Result<OptionalList<hir.Statement>> {
    return new ResultArray(nodes.map((e) => VISIT_STMTS.visit(e, state)))
      .toOptionalList()
      .mapOk((list) => list.filter((s: hir.Statement | null): s is hir.Statement => s !== null));
  }

  visit(node: ASTv2.ContentNode, state: NormalizationState): Result<hir.Statement | null> {
    switch (node.type) {
      case 'GlimmerComment':
        return Ok(null);
      case 'AppendContent':
        return this.AppendContent(node);
      case 'HtmlText':
        return Ok(this.TextNode(node));
      case 'HtmlComment':
        return Ok(this.HtmlComment(node));
      case 'InvokeBlock':
        return this.InvokeBlock(node, state);
      case 'InvokeComponent':
        return this.Component(node, state);
      case 'SimpleElement':
        return this.SimpleElement(node, state);
    }
  }

  InvokeBlock(node: ASTv2.InvokeBlock, state: NormalizationState): Result<hir.Statement> {
    let translated = BLOCK_KEYWORDS.translate(node, state);

    if (translated !== null) {
      return translated;
    }

    let head = VISIT_EXPRS.visit(node.callee);
    let args = VISIT_EXPRS.Args(node.args);

    return Result.all(head, args).andThen(([head, args]) =>
      this.NamedBlocks(node.blocks, state).mapOk(
        (blocks) =>
          new hir.BlockInvocation(node.loc, {
            head,
            args,
            blocks,
          })
      )
    );
  }

  NamedBlocks(blocks: ASTv2.NamedBlocks, state: NormalizationState): Result<hir.NamedBlocks> {
    let list = new ResultArray(blocks.blocks.map((b) => this.NamedBlock(b, state)));

    return list
      .toArray()
      .mapOk((list) => new hir.NamedBlocks(blocks.loc, { blocks: OptionalList(list) }));
  }

  NamedBlock(named: ASTv2.NamedBlock, state: NormalizationState): Result<hir.NamedBlock> {
    let body = VISIT_STMTS.visitList(named.block.body, state);

    return body.mapOk((body) => {
      return new hir.NamedBlock(named.loc, {
        name: named.name,
        body: body.toArray(),
        table: named.block.table,
      });
    });
  }

  SimpleElement(element: ASTv2.SimpleElement, state: NormalizationState): Result<hir.Statement> {
    return new ClassifiedElement(
      element,
      new ClassifiedSimpleElement(element.tag, element, hasDynamicFeatures(element)),
      state
    ).toStatement();
  }

  Component(component: ASTv2.InvokeComponent, state: NormalizationState): Result<hir.Statement> {
    return VISIT_EXPRS.visit(component.callee).andThen((callee) =>
      new ClassifiedElement(
        component,
        new ClassifiedComponent(callee, component),
        state
      ).toStatement()
    );
  }

  AppendContent(append: ASTv2.AppendContent): Result<hir.Statement> {
    let translated = APPEND_KEYWORDS.translate(append);

    if (translated !== null) {
      return translated;
    }

    let value = VISIT_EXPRS.visit(append.value);

    return value.mapOk((value) => {
      if (append.trusting) {
        return new hir.AppendTrustedHTML(append.loc, {
          value,
        });
      } else {
        return new hir.AppendTextNode(append.loc, {
          value,
        });
      }
    });
  }

  TextNode(text: ASTv2.HtmlText): hir.Statement {
    if (WHITESPACE.exec(text.chars)) {
      return new hir.AppendWhitespace(text.loc, { value: text.chars });
    } else {
      return new hir.AppendTextNode(text.loc, {
        value: new hir.Literal(text.loc, { value: text.chars }),
      });
    }
  }

  HtmlComment(comment: ASTv2.HtmlComment): hir.Statement {
    return new hir.AppendComment(comment.loc, {
      value: comment.text,
    });
  }
}

export const VISIT_STMTS = new NormalizationStatements();
