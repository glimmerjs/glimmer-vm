import { Optional, PresentArray } from '@glimmer/interfaces';
import { ASTv2 } from '@glimmer/syntax';
import { assign } from '@glimmer/util';
import { UnlocatedOp } from '../../../shared/op';
import { Ok, Result } from '../../../shared/result';
import * as pass1 from '../../pass1/hir';
import { Pass1Stmt, VisitorContext, VisitorInterface } from '../context';
import { BLOCK_KEYWORDS } from '../keywords';
import { ClassifiedElement, hasDynamicFeatures } from './element/classified';
import { ClassifiedComponent } from './element/component';
import { ClassifiedSimpleElement } from './element/simple-element';
import { TemporaryNamedBlock } from './element/temporary-block';

// Whitespace is allowed around and between named blocks
const WHITESPACE = /^\s+$/;

export type Pass1Out = Pass1Stmt | pass1.NamedBlock;

export class Pass0Statements implements VisitorInterface<ASTv2.Statement, Pass1Out> {
  visit<K extends keyof Pass0Statements & keyof ASTv2.Nodes>(
    node: ASTv2.Node & { type: K },
    ctx: VisitorContext
  ): ReturnType<Pass0Statements[K]> {
    let f = this[node.type] as (node: ASTv2.Node & { type: K }, ctx: VisitorContext) => Pass1Out;
    return f(node, ctx) as ReturnType<Pass0Statements[K]>;
  }

  PartialStatement(): never {
    throw new Error(`Handlebars partials are not supported in Glimmer`);
  }

  BlockStatement(node: ASTv2.BlockStatement, ctx: VisitorContext): Result<pass1.Statement> {
    let { utils } = ctx;

    if (BLOCK_KEYWORDS.match(node)) {
      return BLOCK_KEYWORDS.translate(node, ctx);
    } else {
      return ctx
        .block(utils.slice('default').offsets(null), node.program)
        .andThen(
          (defaultBlock): Result<Optional<PresentArray<pass1.NamedBlock>>> => {
            if (node.inverse) {
              return ctx
                .block(utils.slice('else').offsets(null), node.inverse)
                .mapOk((inverseBlock) => {
                  return [defaultBlock, inverseBlock];
                });
            } else {
              return Ok([defaultBlock]);
            }
          }
        )
        .mapOk((blocks) =>
          utils
            .op(
              pass1.BlockInvocation,
              assign(
                {
                  head: ctx.utils.visitExpr(node.func),
                },
                utils.args(node),
                { blocks }
              )
            )
            .loc(node)
        );
    }
  }

  NamedBlock(block: ASTv2.NamedBlock, { utils }: VisitorContext): Result<pass1.NamedBlock> {
    return utils.visitStmts(block.children).andThen((stmts) =>
      new TemporaryNamedBlock(
        {
          name: utils.slice(block.blockName.name).loc(block),
          table: block.table,
          body: stmts,
        },
        utils.source.offsetsFor(block)
      ).tryNamedBlock(utils.source)
    );
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
      new ClassifiedComponent(ctx.utils.visitExpr(component.head), component),
      ctx
    ).toStatement();
  }

  MustacheCommentStatement(
    node: ASTv2.MustacheCommentStatement,
    { utils }: VisitorContext
  ): pass1.Ignore {
    return utils.op(pass1.Ignore).loc(node);
  }

  AppendStatement(append: ASTv2.AppendStatement, ctx: VisitorContext): Result<pass1.Statement> {
    let { value } = append;
    let { utils } = ctx;

    if (ASTv2.isLiteral(value, 'string')) {
      return Ok(appendStringLiteral(ctx, value, { trusted: append.trusting }).loc(append));
    }

    return Ok(utils.append(utils.visitExpr(value), { trusted: append.trusting }).loc(append));
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

export const STATEMENTS = new Pass0Statements();

export function isStatement(
  node: ASTv2.Node | { type: keyof Pass0Statements }
): node is { type: keyof Pass0Statements } {
  return node.type in STATEMENTS;
}

function appendStringLiteral(
  ctx: VisitorContext,
  expr: ASTv2.InternalExpression,
  { trusted }: { trusted: boolean }
): UnlocatedOp<pass1.Statement> {
  if (trusted) {
    return ctx.utils.op(pass1.AppendTrustedHTML, {
      value: ctx.utils.visitExpr(expr),
    });
  } else {
    return ctx.utils.op(pass1.AppendTextNode, {
      value: ctx.utils.visitExpr(expr),
    });
  }
}
