import { ExpressionContext } from '@glimmer/interfaces';
import { AST, SyntaxError } from '@glimmer/syntax';
import { assertPresent, assign } from '@glimmer/util';
import * as pass1 from '../../pass1/ops';
import { getAttrNamespace } from '../../../utils';
import { buildArgs } from './builders';
import { Context } from '../context';
import { assertIsSimpleHelper, isHelperInvocation, isSimplePath, isTrustingNode } from './is-node';
import { EXPR_KEYWORDS } from '../keywords';

export function concat(ctx: Context, concat: AST.ConcatStatement): pass1.Expr {
  let exprs = ctx.mapIntoExprs(assertPresent([...concat.parts].reverse()), part => [
    attrValue(ctx, part).expr,
  ]);
  return ctx.expr(pass1.Concat, { parts: exprs }).loc(concat);
}

export function attr(
  ctx: Context,
  attr: AST.AttrNode,
  hasComponentFeatures: boolean,
  elementNode: AST.ElementNode
): pass1.Statement[] {
  assertValidArgumentName(attr, hasComponentFeatures, elementNode);

  let name = attr.name;
  let namespace = getAttrNamespace(name) || undefined;
  let { expr: value } = attrValue(ctx, attr.value);

  if (name[0] === '@') {
    // Arg
    return ctx.ops(ctx.op(pass1.Arg, { name: ctx.slice(name).offsets(null), value }).loc(attr));
  }

  // Attr
  let isTrusting = isTrustingNode(attr.value);

  // splattributes
  if (name === '...attributes') {
    return ctx.ops(ctx.op(pass1.AttrSplat).loc(attr));
  }

  return ctx.ops(
    ctx
      .op(pass1.Attr, {
        name: ctx.slice(name).offsets(null),
        value,
        namespace,
        kind: {
          trusting: isTrusting,
          component: hasComponentFeatures,
        },
      })
      .loc(attr)
  );
}

function simpleAttrValue(
  ctx: Context,
  value: AST.TextNode | AST.MustacheStatement
): { expr: pass1.Expr; isStatic: boolean } {
  // returns the static value if the value is static
  if (value.type === 'TextNode') {
    return {
      expr: ctx.expr(pass1.Literal, { type: 'StringLiteral', value: value.chars }).loc(value),
      isStatic: true,
    };
  }

  if (EXPR_KEYWORDS.match(value)) {
    return { expr: EXPR_KEYWORDS.translate(value, ctx), isStatic: false };
  }

  if (isHelperInvocation(value)) {
    assertIsSimpleHelper(value, value.loc, 'helper');

    return {
      expr: ctx
        .expr(
          pass1.SubExpression,
          assign(
            {
              head: ctx.visitExpr(value.path, ExpressionContext.CallHead),
            },
            buildArgs(ctx, value)
          )
        )
        .loc(value),
      isStatic: false,
    };
  }

  if (value.path.type === 'PathExpression' && isSimplePath(value.path)) {
    // x={{simple}}
    return {
      expr: ctx.visitExpr(value.path, ExpressionContext.AppendSingleId),
      isStatic: false,
    };
  } else {
    // x={{simple.value}}
    return { expr: ctx.visitExpr(value.path, ExpressionContext.Expression), isStatic: false };
  }
}

export function attrValue(
  ctx: Context,
  value: AST.TextNode | AST.MustacheStatement | AST.ConcatStatement
): { expr: pass1.Expr; isStatic: boolean } {
  if (value.type === 'ConcatStatement') {
    return {
      expr: concat(ctx, value),
      isStatic: false,
    };
  }

  return simpleAttrValue(ctx, value);
}

function assertValidArgumentName(
  attribute: AST.AttrNode,
  isComponent: boolean,
  elementNode: AST.ElementNode
) {
  if (!isComponent && attribute.name[0] === '@') {
    throw new SyntaxError(
      `${attribute.name} is not a valid attribute name. @arguments are only allowed on components, but the tag for this element (\`${elementNode.tag}\`) is a regular, non-component HTML element.`,
      attribute.loc
    );
  }
}
