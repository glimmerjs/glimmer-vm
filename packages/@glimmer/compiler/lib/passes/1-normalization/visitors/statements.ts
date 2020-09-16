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
  visitList(nodes: ASTv2.Statement[], ctx: VisitorContext): Result<pass1.Statement[]> {
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

  visit(node: ASTv2.Statement, ctx: VisitorContext): Result<pass1.Statement | null> {
    switch (node.type) {
      case 'MustacheCommentStatement':
        return Ok(null);
      case 'AppendStatement':
        return this.AppendStatement(node, ctx);
      case 'CommentStatement':
        return Ok(this.CommentStatement(node, ctx));
      case 'BlockStatement':
        return this.BlockStatement(node, ctx);
      case 'Component':
        return this.Component(node, ctx);
      case 'SimpleElement':
        return this.SimpleElement(node, ctx);
      case 'TextNode':
        return Ok(this.TextNode(node, ctx));
    }
  }

  BlockStatement(node: ASTv2.BlockStatement, ctx: VisitorContext): Result<pass1.Statement> {
    if (BLOCK_KEYWORDS.match(node)) {
      return BLOCK_KEYWORDS.translate(node, ctx);
    }

    let { utils } = ctx;

    let named = ASTv2.getBlock(node.blocks, 'default');

    return ctx
      .block(utils.slice('default').offsets(null), named.block)
      .andThen(
        (defaultBlock): Result<OptionalList<pass1.NamedBlock>> => {
          if (ASTv2.hasBlock(node.blocks, 'else')) {
            let inverse = ASTv2.getBlock(node.blocks, 'else');
            return ctx
              .block(utils.slice('else').offsets(null), inverse.block)
              .mapOk((inverseBlock) => {
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
                head: VISIT_EXPRS.visit(node.func, ctx),
              },
              utils.args(node),
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
      let name = utils.slice(named.blockName.name).loc(named.blockName);

      return utils.op(pass1.NamedBlock, { name, body, table: named.block.table }).loc(named.loc);
    });
  }

  SimpleElement(element: ASTv2.SimpleElement, ctx: VisitorContext): Result<pass1.Statement> {
    return new ClassifiedElement(
      element,
      new ClassifiedSimpleElement(
        ctx.utils.slice(element.tag).loc(element.loc),
        element,
        hasDynamicFeatures(element)
      ),
      ctx
    ).toStatement();
  }

  Component(component: ASTv2.Component, ctx: VisitorContext): Result<pass1.Statement> {
    return new ClassifiedElement(
      component,
      new ClassifiedComponent(VISIT_EXPRS.visit(component.head, ctx), component),
      ctx
    ).toStatement();
  }

  AppendStatement(append: ASTv2.AppendStatement, ctx: VisitorContext): Result<pass1.Statement> {
    if (APPEND_KEYWORDS.match(append)) {
      return APPEND_KEYWORDS.translate(append, ctx);
    }

    let { value } = append;
    let { utils } = ctx;

    if (ASTv2.isLiteral(value, 'string')) {
      return Ok(appendStringLiteral(ctx, value, { trusted: append.trusting }).loc(append));
    }

    return Ok(
      utils.append(VISIT_EXPRS.visit(value, ctx), { trusted: append.trusting }).loc(append)
    );
  }

  TextNode(text: ASTv2.TextNode, { utils }: VisitorContext): pass1.Statement {
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

  CommentStatement(comment: ASTv2.CommentStatement, { utils }: VisitorContext): pass1.Statement {
    return utils
      .op(pass1.AppendComment, {
        value: comment.value,
      })
      .loc(comment);
  }
}

export const VISIT_STMTS = new Pass0Statements();

export function isStatement(node: ASTv2.Node): node is ASTv2.Statement {
  return node.type in VISIT_STMTS;
}

function appendStringLiteral(
  ctx: VisitorContext,
  expr: ASTv2.InternalExpression,
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
