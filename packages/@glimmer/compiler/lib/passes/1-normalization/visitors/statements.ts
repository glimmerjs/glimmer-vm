import { ASTv2 } from '@glimmer/syntax';
import { assign } from '@glimmer/util';
import { OptionalList } from '../../../shared/list';
import { UnlocatedOp } from '../../../shared/op';
import { Ok, Result } from '../../../shared/result';
import * as pass1 from '../../2-symbol-allocation/hir';
import { HirStmt, VisitorContext } from '../context';
import { BLOCK_KEYWORDS } from '../keywords';
import { APPEND_KEYWORDS } from '../keywords/append';
import { ClassifiedElement, hasDynamicFeatures } from './element/classified';
import { ClassifiedComponent } from './element/component';
import { ClassifiedSimpleElement } from './element/simple-element';
import { VISIT_EXPRS } from './expressions';

// Whitespace is allowed around and between named blocks
const WHITESPACE = /^\s+$/;

export type Pass1Out = HirStmt | pass1.NamedBlock;

export class Pass0Statements {
  visitList(nodes: readonly ASTv2.ContentNode[], ctx: VisitorContext): Result<pass1.Statement[]> {
    let out: pass1.Statement[] = [];

    for (let node of nodes) {
      let result = this.visit(node, ctx);

      if (result.isErr) {
        return result.cast();
      } else if (result.value !== null) {
        out.push(result.value);
      }
    }

    return Ok(out);
  }

  visit(node: ASTv2.ContentNode, ctx: VisitorContext): Result<pass1.Statement | null> {
    switch (node.type) {
      case 'GlimmerComment':
        return Ok(null);
      case 'AppendContent':
        return this.AppendContent(node, ctx);
      case 'HtmlComment':
        return Ok(this.HtmlComment(node, ctx));
      case 'InvokeBlock':
        return this.InvokeBlock(node, ctx);
      case 'InvokeComponent':
        return this.Component(node, ctx);
      case 'SimpleElement':
        return this.SimpleElement(node, ctx);
      case 'HtmlText':
        return Ok(this.TextNode(node, ctx));
    }
  }

  InvokeBlock(node: ASTv2.InvokeBlock, ctx: VisitorContext): Result<pass1.Statement> {
    if (BLOCK_KEYWORDS.match(node)) {
      return BLOCK_KEYWORDS.translate(node, ctx);
    }

    let { utils } = ctx;

    let named = node.blocks.get('default');

    return ctx
      .block(utils.slice('default'), named.block)
      .andThen(
        (defaultBlock): Result<OptionalList<pass1.NamedBlock>> => {
          let inverse = node.blocks.get('else');
          if (inverse) {
            return ctx.block(inverse.name, inverse.block).mapOk((inverseBlock) => {
              return OptionalList([defaultBlock, inverseBlock]);
            });
          } else {
            return Ok(OptionalList([defaultBlock]));
          }
        }
      )
      .mapOk((blocks) =>
        utils
          .op(
            pass1.BlockInvocation,
            assign(
              {
                head: VISIT_EXPRS.visit(node.callee, ctx),
              },
              utils.args({ func: node.callee, args: node.args }),
              { blocks }
            )
          )
          .loc(node)
      );
  }

  NamedBlock(named: ASTv2.NamedBlock, ctx: VisitorContext): Result<pass1.NamedBlock> {
    let { utils } = ctx;

    let body = VISIT_STMTS.visitList(named.block.body, ctx);

    return body.mapOk((body) => {
      return utils
        .op(pass1.NamedBlock, { name: named.name, body, table: named.block.table })
        .loc(named.loc);
    });
  }

  SimpleElement(element: ASTv2.SimpleElement, ctx: VisitorContext): Result<pass1.Statement> {
    return new ClassifiedElement(
      element,
      new ClassifiedSimpleElement(element.tag, element, hasDynamicFeatures(element)),
      ctx
    ).toStatement();
  }

  Component(component: ASTv2.InvokeComponent, ctx: VisitorContext): Result<pass1.Statement> {
    return new ClassifiedElement(
      component,
      new ClassifiedComponent(VISIT_EXPRS.visit(component.callee, ctx), component),
      ctx
    ).toStatement();
  }

  AppendContent(append: ASTv2.AppendContent, ctx: VisitorContext): Result<pass1.Statement> {
    if (APPEND_KEYWORDS.match(append)) {
      return APPEND_KEYWORDS.translate(append, ctx);
    }

    let { value } = append;
    let { utils } = ctx;

    if (value.isLiteral('string')) {
      return Ok(appendStringLiteral(ctx, value, { trusted: append.trusting }).loc(append));
    }

    return Ok(
      utils.append(VISIT_EXPRS.visit(value, ctx), { trusted: append.trusting }).loc(append)
    );
  }

  TextNode(text: ASTv2.HtmlText, { utils }: VisitorContext): pass1.Statement {
    if (WHITESPACE.exec(text.chars)) {
      return utils.op(pass1.AppendWhitespace, { value: text.chars }).loc(text);
    } else {
      return utils
        .op(pass1.AppendTextNode, {
          value: utils.op(pass1.Literal, { value: text.chars }).loc(text),
        })
        .loc(text);
    }
  }

  HtmlComment(comment: ASTv2.HtmlComment, { utils }: VisitorContext): pass1.Statement {
    return utils
      .op(pass1.AppendComment, {
        value: comment.text,
      })
      .loc(comment);
  }
}

export const VISIT_STMTS = new Pass0Statements();

export function isContent(node: ASTv2.Node): node is ASTv2.ContentNode {
  return node.type in VISIT_STMTS;
}

function appendStringLiteral(
  ctx: VisitorContext,
  expr: ASTv2.Expression,
  { trusted }: { trusted: boolean }
): UnlocatedOp<pass1.Statement> {
  if (trusted) {
    return ctx.utils.op(pass1.AppendTrustedHTML, {
      value: VISIT_EXPRS.visit(expr, ctx),
    });
  } else {
    return ctx.utils.op(pass1.AppendTextNode, {
      value: VISIT_EXPRS.visit(expr, ctx),
    });
  }
}
