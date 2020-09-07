import { ExpressionContext, Option, PresentArray } from '@glimmer/interfaces';
import { AST, builders, GlimmerSyntaxError, SourceLocation } from '@glimmer/syntax';
import { assertPresent, assign, ifPresent, isPresent, mapPresent } from '@glimmer/util';
import { getAttrNamespace } from '../../../utils';
// import { Option } from '@glimmer/interfaces';
import * as pass1 from '../../pass1/ops';
import { SymbolTable } from '../../shared/symbol-table';
import { Context } from '../context';
import { EXPR_KEYWORDS } from '../keywords/exprs';
import { buildArgs, buildHash, buildParams, buildPathWithContext } from '../utils/builders';
import {
  assertIsSimpleHelper,
  isHelperInvocation,
  isSimplePath,
  isTrustingNode,
} from '../utils/is-node';

export function ElementNode(
  element: AST.ElementNode,
  ctx: Context
): pass1.Statement | pass1.NamedBlock | pass1.TemporaryNamedBlock {
  // Named blocks are special. When we see them, we return a TemporaryNamedBlock, which
  // are only allowed directly inside a component invocation, and only if there is no
  // other semantic content alongside the named block. Any other context that sees a
  // TemporaryNamedBlock produces a syntax error.
  if (isNamedBlock(element)) {
    return ctx.withBlock(element, (child) => {
      return ctx
        .op(pass1.TemporaryNamedBlock, {
          name: ctx.slice(element.tag.slice(1)).loc(element),
          table: child,
          body: ctx.mapIntoOps(element.children, (stmt) => ctx.visitStmt(stmt)),
        })
        .loc(element);
    });
  }

  let classified = classify(ctx, element);

  let result = attributes(element.attributes, classified.type === 'Component');

  if (result.type === 'error') {
    throw new GlimmerSyntaxError(
      `${result.attr.name} is not a valid attribute name. @arguments are only allowed on components, but the tag for this element (\`${element.tag}\`) is a regular, non-component HTML element.`,
      result.attr.loc
    );
  }

  let { attrs: attrNodes, args: argNodes } = result;

  let outAttrs: pass1.ElementParameter[] = attrNodes.map((a) =>
    attr(ctx, a, classified.dynamicFeatures, element)
  );
  let outArgPairs = argNodes.map((a) => arg(ctx, a, classified.dynamicFeatures, element));
  let outArgs = isPresent(outArgPairs)
    ? ctx.op(pass1.NamedArguments, { pairs: outArgPairs }).offsets(outArgPairs)
    : ctx.op(pass1.EmptyNamedArguments).offsets(null);

  let modifiers: pass1.ElementParameter[] = ctx.mapIntoOps(element.modifiers, (statement) =>
    modifier(ctx, statement)
  );

  let paramList = [...outAttrs, ...modifiers];
  let elementParams = ifPresent(
    paramList,
    (list) => ctx.op(pass1.ElementParameters, { body: list }),
    () => ctx.op(pass1.EmptyElementParameters)
  ).offsets(null);

  let classifiedBlock = ctx.withBlock(element, (child) => {
    let body = ctx.mapIntoOps(element.children, (stmt) => ctx.visitAmbiguousStmt(stmt));
    let block = ctx
      .op(pass1.TemporaryNamedBlock, {
        name: ctx.slice('default').offsets(null),
        table: child,
        body,
      })
      .loc(element);
    return classifyBody(element, block);
  });

  if (classifiedBlock.type === 'named-blocks' && classified.type !== 'Component') {
    throw new GlimmerSyntaxError(`Named blocks are only allowed inside a component`, element.loc);
  }

  switch (classified.type) {
    case 'Element': {
      assertNoNamedBlocks(classifiedBlock, classified, element.loc);
      let { type, ...rest } = classified;

      return ctx
        .op(
          pass1.SimpleElement,
          assign(rest, {
            params: elementParams,
            body: classifiedBlock.block,
          })
        )
        .loc(element);
    }

    case 'Component': {
      let { type, ...rest } = classified;

      let blocks =
        classifiedBlock.type === 'named-block'
          ? ctx.op(pass1.NamedBlocks, { blocks: [classifiedBlock.block] }).loc(element)
          : ctx.op(pass1.NamedBlocks, { blocks: classifiedBlock.blocks }).loc(element);

      return ctx
        .op(
          pass1.Component,
          assign(rest, {
            params: elementParams,
            args: outArgs,
            blocks: element.selfClosing ? ctx.op(pass1.EmptyNamedBlocks).loc(element) : blocks,
          })
        )
        .loc(element);
    }
  }
}

type ClassifiedBody =
  | {
      type: 'named-block';
      block: pass1.NamedBlock;
    }
  | {
      type: 'named-blocks';
      blocks: PresentArray<pass1.NamedBlock>;
    };

export function arg(
  ctx: Context,
  attr: AST.AttrNode,
  hasComponentFeatures: boolean,
  elementNode: AST.ElementNode
): pass1.NamedArgument {
  assertValidArgumentName(attr, hasComponentFeatures, elementNode);

  let name = attr.name;
  let nameSlice = ctx.slice(name).offsets(null);

  let value = dynamicAttrValue(ctx, attr.value);

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
  let value = dynamicAttrValue(ctx, rawValue);

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
): pass1.Expr {
  // returns the static value if the value is static
  if (value.type === 'TextNode') {
    return ctx.op(pass1.Literal, { value: value.chars }).loc(value);
  }

  if (EXPR_KEYWORDS.match(value)) {
    return EXPR_KEYWORDS.translate(value, ctx);
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
          buildArgs(ctx, value)
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
    let exprs = mapPresent(assertPresent(value.parts), (part) => dynamicAttrValue(ctx, part));

    return ctx.op(pass1.Concat, { parts: exprs }).loc(value);
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

function assertNoNamedBlocks(
  body: ClassifiedBody,
  el: ClassifiedElement,
  loc: SourceLocation
): asserts body is { type: 'named-block'; block: pass1.NamedBlock } {
  if (body.type === 'named-blocks' && el.type !== 'Component') {
    throw new GlimmerSyntaxError(`Named blocks are only allowed inside a component`, loc);
  }
}

function classifyBody(element: AST.ElementNode, block: pass1.TemporaryNamedBlock): ClassifiedBody {
  if (block.isValidNamedBlock()) {
    return { type: 'named-block', block: block.asNamedBlock() };
  } else if (block.hasValidNamedBlocks()) {
    let children = block.asNamedBlocks();

    switch (children.type) {
      case 'error':
        throw new GlimmerSyntaxError(children.desc, element.loc);
      default:
        return children;
    }
  } else {
    // there were semantic children and named blocks
    throw new GlimmerSyntaxError(
      `a component cannot have semantic content and named blocks`,
      element.loc
    );
  }
}

function modifier(ctx: Context, modifier: AST.ElementModifierStatement): pass1.Modifier {
  if (isHelperInvocation(modifier)) {
    assertIsSimpleHelper(modifier, modifier.loc, 'modifier');
  }

  return ctx
    .op(pass1.Modifier, {
      head: ctx.visitExpr(modifier.path, ExpressionContext.ModifierHead),
      params: buildParams(ctx, { path: modifier.path, params: modifier.params }),
      hash: buildHash(ctx, modifier.hash),
    })
    .loc(modifier);
}

function isNamedBlock(element: AST.ElementNode): boolean {
  return element.tag[0] === ':';
}

type ElementKind = 'NamedArg' | 'This' | 'Local' | 'Uppercase' | 'Element';

function isUpperCase(tag: string): boolean {
  return tag[0] === tag[0].toUpperCase() && tag[0] !== tag[0].toLowerCase();
}

function classifyTag(variable: string, currentSymbols: SymbolTable): ElementKind {
  debugger;
  if (variable[0] === '@') {
    return 'NamedArg';
  } else if (variable === 'this') {
    return 'This';
  } else if (currentSymbols.has(variable)) {
    return 'Local';
  } else if (isUpperCase(variable)) {
    return 'Uppercase';
  } else {
    return 'Element';
  }
}

function classify(
  ctx: Context,
  { tag, loc, attributes, modifiers }: AST.ElementNode
): ClassifiedElement {
  // this code is parsing the expression at the head of component, which
  // is not done by @glimmer/syntax, and notably is scope-sensitive.

  let [maybeLocal, ...rest] = tag.split('.');

  let kind = classifyTag(maybeLocal, ctx.symbols.current);

  let path: AST.PathExpression;

  switch (kind) {
    case 'Element':
      return {
        type: 'Element',
        tag: ctx.slice(tag).loc(loc),
        dynamicFeatures: hasDynamicFeatures({ attributes, modifiers }),
      };

    case 'Uppercase':
      return {
        type: 'Component',
        tag: ctx
          .op(pass1.GetVar, {
            name: ctx.slice(ctx.customizeComponentName(tag)).offsets(null),
            context: ExpressionContext.ComponentHead,
          })
          .loc(loc),
        dynamicFeatures: true,
      };

    case 'Local':
      path = builders.fullPath(builders.var(maybeLocal), rest);
      break;
    case 'This':
      path = builders.fullPath(builders.this(), rest);
      break;
    case 'NamedArg':
      path = builders.fullPath(builders.at(maybeLocal), rest, loc);
      break;
  }

  return {
    type: 'Component',
    tag: ctx.visitExpr(path, ExpressionContext.ComponentHead),
    dynamicFeatures: true,
  };
}

type ClassifiedElement =
  | {
      type: 'Component';
      tag: pass1.Expr;
      dynamicFeatures: true;
    }
  | {
      type: 'Element';
      tag: pass1.SourceSlice;
      dynamicFeatures: boolean;
    };

function hasDynamicFeatures({
  attributes,
  modifiers,
}: Pick<AST.ElementNode, 'attributes' | 'modifiers'>): boolean {
  // ElementModifier needs the special ComponentOperations
  if (modifiers.length > 0) {
    return true;
  }

  // Splattributes need the special ComponentOperations to merge into
  return !!attributes.find((attr) => attr.name === '...attributes');
}

function attributes(
  all: AST.AttrNode[],
  isComponent: boolean
):
  | { type: 'success'; attrs: AST.AttrNode[]; args: AST.AttrNode[] }
  | { type: 'error'; attr: AST.AttrNode } {
  let attrs: AST.AttrNode[] = [];
  let args: AST.AttrNode[] = [];

  let typeAttr: Option<AST.AttrNode> = null;

  for (let attr of all) {
    if (attr.name === 'type') {
      typeAttr = attr;
    } else if (attr.name[0] === '@') {
      if (!isComponent) {
        return {
          type: 'error',
          attr,
        };
      }

      args.push(attr);
    } else {
      attrs.push(attr);
    }
  }

  if (typeAttr) {
    attrs.push(typeAttr);
  }

  return { type: 'success', attrs, args };
}
