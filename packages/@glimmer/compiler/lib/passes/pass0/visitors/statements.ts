import { ExpressionContext, PresentArray } from '@glimmer/interfaces';
import { AST, isLiteral } from '@glimmer/syntax';
import { assign } from '@glimmer/util';
import * as pass1 from '../../pass1/ops';
import { UnlocatedOp } from '../../shared/op';
import { Context, Pass1Stmt, VisitorInterface } from '../context';
import { BLOCK_KEYWORDS, EXPR_KEYWORDS, STATEMENT_KEYWORDS } from '../keywords';
import { buildArgs } from '../utils/builders';
import { assertIsSimpleHelper, isHelperInvocation, isSimplePath } from '../utils/is-node';
import { ElementNode } from './element';

// Whitespace is allowed around and between named blocks
const WHITESPACE = /^\s+$/;

export class Pass0Statements implements VisitorInterface<AST.Statement, Pass1Stmt> {
  PartialStatement(): never {
    throw new Error(`Handlebars partials are not supported in Glimmer`);
  }

  BlockStatement(block: AST.BlockStatement, ctx: Context): pass1.Statement {
    if (BLOCK_KEYWORDS.match(block)) {
      return BLOCK_KEYWORDS.translate(block, ctx);
    } else {
      let blocks: PresentArray<pass1.NamedBlock> = [
        ctx.visitBlock(ctx.slice('default').offsets(null), block.program),
      ];

      if (block.inverse) {
        blocks.push(ctx.visitBlock(ctx.slice('else').offsets(null), block.inverse));
      }

      return ctx
        .op(
          pass1.BlockInvocation,
          assign(
            {
              head: ctx.visitExpr(block.path, ExpressionContext.BlockHead),
            },
            buildArgs(ctx, block),
            { blocks }
          )
        )
        .loc(block);
    }
  }

  ElementNode(
    element: AST.ElementNode,
    ctx: Context
  ): pass1.Statement | pass1.NamedBlock | pass1.TemporaryNamedBlock {
    return ElementNode(element, ctx);
  }

  MustacheCommentStatement(node: AST.MustacheCommentStatement, ctx: Context): pass1.Ignore {
    return ctx.op(pass1.Ignore).loc(node);
  }

  MustacheStatement(mustache: AST.MustacheStatement, ctx: Context): pass1.Statement {
    let { path } = mustache;

    if (isLiteral(path)) {
      return appendExpr(ctx, path, { trusted: !mustache.escaped }).loc(mustache);
    }

    if (STATEMENT_KEYWORDS.match(mustache)) {
      return STATEMENT_KEYWORDS.translate(mustache, ctx);
    }

    // {{has-block}} or {{has-block-params}}
    if (EXPR_KEYWORDS.match(mustache)) {
      return ctx
        .append(EXPR_KEYWORDS.translate(mustache, ctx), { trusted: !mustache.escaped })
        .loc(mustache);
    }

    if (!isHelperInvocation(mustache)) {
      return appendExpr(ctx, mustache.path, {
        trusted: !mustache.escaped,
        context: mustacheContext(mustache.path),
      }).loc(mustache);
    }

    assertIsSimpleHelper(mustache, mustache.loc, 'helper');

    return ctx
      .append(
        ctx
          .op(
            pass1.SubExpression,
            assign(
              {
                head: ctx.visitExpr(mustache.path, ExpressionContext.CallHead),
              },
              buildArgs(ctx, mustache)
            )
          )
          .loc(mustache),
        {
          trusted: !mustache.escaped,
        }
      )
      .loc(mustache);
  }

  TextNode(text: AST.TextNode, ctx: Context): pass1.Statement {
    if (WHITESPACE.exec(text.chars)) {
      return ctx.op(pass1.AppendWhitespace, { value: text.chars }).loc(text);
    } else {
      return ctx
        .op(pass1.AppendTextNode, {
          value: ctx.op(pass1.Literal, { value: text.chars }).loc(text),
        })
        .loc(text);
    }
  }

  CommentStatement(comment: AST.CommentStatement, ctx: Context): pass1.Statement {
    return ctx
      .op(pass1.AppendComment, {
        value: comment.value,
      })
      .loc(comment);
  }
}

export const STATEMENTS = new Pass0Statements();

function mustacheContext(body: AST.Expression): ExpressionContext {
  if (body.type === 'PathExpression') {
    if (!isSimplePath(body)) {
      return ExpressionContext.Expression;
    } else {
      return ExpressionContext.AppendSingleId;
    }
  } else {
    return ExpressionContext.Expression;
  }
}

function appendExpr(
  ctx: Context,
  expr: AST.Expression,
  {
    context = ExpressionContext.Expression,
    trusted,
  }: { trusted: boolean; context?: ExpressionContext }
): UnlocatedOp<pass1.Statement> {
  if (trusted) {
    return ctx.op(pass1.AppendTrustedHTML, {
      value: ctx.visitExpr(expr, context),
    });
  } else {
    return ctx.op(pass1.AppendTextNode, {
      value: ctx.visitExpr(expr, context),
    });
  }
}
