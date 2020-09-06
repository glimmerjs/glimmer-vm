import { ExpressionContext } from '@glimmer/interfaces';
import { AST, GlimmerSyntaxError } from '@glimmer/syntax';
import { assertPresent, assign } from '@glimmer/util';
import { getAttrNamespace } from '../../../utils';
import * as pass1 from '../../pass1/ops';
import { Context } from '../context';
import { EXPR_KEYWORDS } from '../keywords';
import { buildArgs } from './builders';
import { assertIsSimpleHelper, isHelperInvocation, isSimplePath, isTrustingNode } from './is-node';

export function concat(ctx: Context, concat: AST.ConcatStatement): pass1.Concat {
  let exprs = ctx.mapIntoExprs(assertPresent(concat.parts), (part) => [
    dynamicAttrValue(ctx, part).value,
  ]);
  return ctx.op(pass1.Concat, { parts: exprs }).loc(concat);
}

export function arg(
  ctx: Context,
  attr: AST.AttrNode,
  hasComponentFeatures: boolean,
  elementNode: AST.ElementNode
): pass1.NamedArgument {
  assertValidArgumentName(attr, hasComponentFeatures, elementNode);

  let name = attr.name;
  let nameSlice = ctx.slice(name).offsets(null);

  let { value } = dynamicAttrValue(ctx, attr.value);

  return ctx
    .op(pass1.NamedArgument, {
      key: nameSlice,
      value,
    })
    .loc(attr);
}

export function attr(
  ctx: Context,
  attr: AST.AttrNode,
  hasComponentFeatures: boolean,
  elementNode: AST.ElementNode
): pass1.Attr | pass1.AttrSplat {
  assertValidArgumentName(attr, hasComponentFeatures, elementNode);

  let name = attr.name;
  let rawValue = attr.value;

  let namespace = getAttrNamespace(name) || undefined;
  let { value } = dynamicAttrValue(ctx, rawValue);

  let isTrusting = isTrustingNode(attr.value);

  // splattributes
  // this is grouped together with attributes because its position matters
  if (name === '...attributes') {
    return ctx.op(pass1.AttrSplat).loc(attr);
  }

  return ctx
    .op(pass1.Attr, {
      name: ctx.slice(name).offsets(null),
      value: value,
      namespace,
      kind: {
        trusting: isTrusting,
        component: hasComponentFeatures,
      },
    })
    .loc(attr);
}

function simpleDynamicAttrValue(
  ctx: Context,
  value: AST.MustacheStatement | AST.TextNode
): { value: pass1.Expr; isStatic: boolean } {
  // returns the static value if the value is static
  if (value.type === 'TextNode') {
    return {
      value: ctx.op(pass1.Literal, { value: value.chars }).loc(value),
      isStatic: true,
    };
  }

  if (EXPR_KEYWORDS.match(value)) {
    return { value: EXPR_KEYWORDS.translate(value, ctx), isStatic: false };
  }

  if (isHelperInvocation(value)) {
    assertIsSimpleHelper(value, value.loc, 'helper');

    return {
      value: ctx
        .op(
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
      value: ctx.visitExpr(value.path, ExpressionContext.AppendSingleId),
      isStatic: false,
    };
  } else {
    // x={{simple.value}}
    return { value: ctx.visitExpr(value.path, ExpressionContext.Expression), isStatic: false };
  }
}

export function dynamicAttrValue(
  ctx: Context,
  value: AST.TextNode | AST.MustacheStatement | AST.ConcatStatement
): { value: pass1.Expr; isStatic: boolean } {
  if (value.type === 'ConcatStatement') {
    return {
      value: concat(ctx, value),
      isStatic: false,
    };
  }

  return simpleDynamicAttrValue(ctx, value);
}

function assertValidArgumentName(
  attribute: AST.AttrNode,
  isComponent: boolean,
  elementNode: AST.ElementNode
) {
  if (!isComponent && attribute.name[0] === '@') {
    throw new GlimmerSyntaxError(
      `${attribute.name} is not a valid attribute name. @arguments are only allowed on components, but the tag for this element (\`${elementNode.tag}\`) is a regular, non-component HTML element.`,
      attribute.loc
    );
  }
}
