import { ExpressionContext } from '@glimmer/interfaces';
import { AST } from '@glimmer/syntax';
import { assert, assign } from '@glimmer/util';
import { OptionalList, PresentList } from '../../../../shared/list';
import { Result } from '../../../../shared/result';
import * as pass1 from '../../../pass1/ops';
import { Context } from '../../context';
import { EXPR_KEYWORDS } from '../../keywords/exprs';
import { buildPathWithContext } from '../../utils/builders';
import { assertIsSimpleHelper, isHelperInvocation, isSimplePath } from '../../utils/is-node';
import { toStatement } from './classify';
import { TemporaryNamedBlock } from './temporary-block';

export function ElementNode(
  element: AST.ElementNode,
  ctx: Context
): Result<pass1.Statement | TemporaryNamedBlock> {
  // Named blocks are special. When we see them, we return a TemporaryNamedBlock, which
  // are only allowed directly inside a component invocation, and only if there is no
  // other semantic content alongside the named block. Any other context that sees a
  // TemporaryNamedBlock produces a syntax error.
  if (isNamedBlock(element)) {
    return ctx.visitStmts(element.children).mapOk((stmts) =>
      ctx.withBlock(
        element,
        (child) =>
          new TemporaryNamedBlock(
            {
              name: ctx.slice(element.tag.slice(1)).loc(element),
              table: child,
              body: stmts,
            },
            ctx.source.offsetsFor(element)
          )
      )
    );
  }

  return toStatement(ctx, element);
}

function simpleDynamicAttrValue(
  ctx: Context,
  value: AST.MustacheStatement | AST.TextNode
): pass1.Expr {
  // returns the static value if the value is static
  if (value.type === 'TextNode') {
    return ctx.op(pass1.Literal, { value: value.chars }).loc(value);
  }

  if (EXPR_KEYWORDS.match(value)) {
    return EXPR_KEYWORDS.translate(value, ctx).expect();
  }

  if (isHelperInvocation(value)) {
    assertIsSimpleHelper(value, value.loc, 'helper');

    return ctx
      .op(
        pass1.SubExpression,
        assign(
          {
            head: ctx.visitExpr(value.path, ExpressionContext.CallHead),
          },
          ctx.args(value)
        )
      )
      .loc(value);
  }

  switch (value.path.type) {
    case 'PathExpression': {
      if (isSimplePath(value.path)) {
        // x={{simple}}
        return buildPathWithContext(ctx, value.path, ExpressionContext.AppendSingleId);
      } else {
        // x={{simple.value}}

        return buildPathWithContext(ctx, value.path, ExpressionContext.Expression);
      }
    }

    default: {
      return ctx.visitExpr(value.path);
    }
  }
}

export function dynamicAttrValue(
  ctx: Context,
  value: AST.TextNode | AST.MustacheStatement | AST.ConcatStatement
): pass1.Expr {
  if (value.type === 'ConcatStatement') {
    let exprs = OptionalList(value.parts.map((part) => dynamicAttrValue(ctx, part)));
    assert(exprs instanceof PresentList, `attribute concats must have at least one part`);

    return ctx.op(pass1.Concat, { parts: exprs }).loc(value);
  }

  return simpleDynamicAttrValue(ctx, value);
}

function isNamedBlock(element: AST.ElementNode): boolean {
  return element.tag[0] === ':';
}
