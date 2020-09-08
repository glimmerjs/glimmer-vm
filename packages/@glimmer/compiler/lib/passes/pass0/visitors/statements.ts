import { ExpressionContext, PresentArray, Option } from '@glimmer/interfaces';
import { AST, isLiteral } from '@glimmer/syntax';
import { assign } from '@glimmer/util';
import * as pass1 from '../../pass1/ops';
import { UnlocatedOp } from '../../shared/op';
import { Ok, Result } from '../../shared/result';
import { Context, Pass1Stmt, VisitorInterface } from '../context';
import { BLOCK_KEYWORDS, EXPR_KEYWORDS, STATEMENT_KEYWORDS } from '../keywords';
import { buildArgs } from '../utils/builders';
import { assertIsSimpleHelper, isHelperInvocation, isSimplePath } from '../utils/is-node';
import { ElementNode } from './element/element-node';
import { TemporaryNamedBlock } from './element/temporary-block';

// Whitespace is allowed around and between named blocks
const WHITESPACE = /^\s+$/;

export class Pass0Statements
  implements VisitorInterface<AST.Statement, Pass1Stmt | TemporaryNamedBlock> {
  PartialStatement(): never {
    throw new Error(`Handlebars partials are not supported in Glimmer`);
  }

  BlockStatement(block: AST.BlockStatement, ctx: Context): Result<pass1.Statement> {
    if (BLOCK_KEYWORDS.match(block)) {
      return BLOCK_KEYWORDS.translate(block, ctx);
    } else {
      return ctx
        .visitBlock(ctx.slice('default').offsets(null), block.program)
        .andThen(
          (defaultBlock): Result<Option<PresentArray<pass1.NamedBlock>>> => {
            if (block.inverse) {
              return ctx
                .visitBlock(ctx.slice('else').offsets(null), block.inverse)
                .mapOk((inverseBlock) => {
                  return [defaultBlock, inverseBlock];
                });
            } else {
              return Ok([defaultBlock]);
            }
          }
        )
        .mapOk((blocks) =>
          ctx
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
            .loc(block)
        );
    }
  }

  ElementNode(
    element: AST.ElementNode,
    ctx: Context
  ): Result<pass1.Statement | TemporaryNamedBlock> {
    return ElementNode(element, ctx);
  }

  MustacheCommentStatement(node: AST.MustacheCommentStatement, ctx: Context): pass1.Ignore {
    return ctx.op(pass1.Ignore).loc(node);
  }

  MustacheStatement(mustache: AST.MustacheStatement, ctx: Context): Result<pass1.Statement> {
    let { path } = mustache;

    if (isLiteral(path)) {
      return Ok(appendExpr(ctx, path, { trusted: !mustache.escaped }).loc(mustache));
    }

    if (STATEMENT_KEYWORDS.match(mustache)) {
      return STATEMENT_KEYWORDS.translate(mustache, ctx);
    }

    // {{has-block}} or {{has-block-params}}
    if (EXPR_KEYWORDS.match(mustache)) {
      return Ok(
        ctx
          .append(EXPR_KEYWORDS.translate(mustache, ctx).expect(), { trusted: !mustache.escaped })
          .loc(mustache)
      );
    }

    if (!isHelperInvocation(mustache)) {
      return Ok(
        appendExpr(ctx, mustache.path, {
          trusted: !mustache.escaped,
          context: mustacheContext(mustache.path),
        }).loc(mustache)
      );
    }

    assertIsSimpleHelper(mustache, mustache.loc, 'helper');

    return Ok(
      ctx
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
        .loc(mustache)
    );
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
