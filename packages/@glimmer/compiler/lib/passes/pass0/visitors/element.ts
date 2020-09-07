import { ExpressionContext, Option, PresentArray } from '@glimmer/interfaces';
import { AST, builders, GlimmerSyntaxError, SourceLocation } from '@glimmer/syntax';
import { assertPresent, assign, ifPresent, isPresent, mapPresent } from '@glimmer/util';
import { getAttrNamespace } from '../../../utils';
// import { Option } from '@glimmer/interfaces';
import * as pass1 from '../../pass1/ops';
import { SymbolTable } from '../../shared/symbol-table';
import { Context } from '../context';
import { EXPR_KEYWORDS } from '../keywords/exprs';
import { buildArgs, buildHash, buildParams } from '../utils/builders';
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

  let elementDetails = classifiedElementDetails(ctx, element);

  let result = attributes(element.attributes, elementDetails.type === 'Component');

  if (result.type === 'error') {
    throw new GlimmerSyntaxError(
      `${result.attr.name} is not a valid attribute name. @arguments are only allowed on components, but the tag for this element (\`${element.tag}\`) is a regular, non-component HTML element.`,
      result.attr.loc
    );
  }

  let { attrs: attrNodes, args: argNodes } = result;

  let outAttrs: pass1.ElementParameter[] = attrNodes.map((a) =>
    attr(ctx, a, elementDetails.hasComponentFeatures, element)
  );
  let outArgPairs = argNodes.map((a) => arg(ctx, a, elementDetails.hasComponentFeatures, element));
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

  if (classifiedBlock.type === 'named-blocks' && elementDetails.type !== 'Component') {
    throw new GlimmerSyntaxError(`Named blocks are only allowed inside a component`, element.loc);
  }

  switch (elementDetails.type) {
    case 'SimpleElement': {
      assertNoNamedBlocks(classifiedBlock, elementDetails, element.loc);
      let { type, ...rest } = elementDetails;

      return ctx
        .op(
          pass1.SimpleElement,
          assign(rest, { params: elementParams, body: classifiedBlock.block })
        )
        .loc(element);
    }
    case 'ElementWithDynamicFeatures': {
      assertNoNamedBlocks(classifiedBlock, elementDetails, element.loc);
      let { type, ...rest } = elementDetails;

      return ctx
        .op(
          pass1.ElementWithDynamicFeatures,
          assign(rest, { params: elementParams, body: classifiedBlock.block })
        )
        .loc(element);
    }

    case 'Component': {
      let { type, selfClosing, ...rest } = elementDetails;

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
            blocks: selfClosing ? ctx.op(pass1.EmptyNamedBlocks).loc(element) : blocks,
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
    let exprs = mapPresent(assertPresent(value.parts), (part) => dynamicAttrValue(ctx, part).value);

    return {
      value: ctx.op(pass1.Concat, { parts: exprs }).loc(value),
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

function assertNoNamedBlocks(
  body: ClassifiedBody,
  el: ClassifiedElementDetails,
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

type ClassifiedElement =
  | {
      is: 'dynamic-tag';
      path: AST.PathExpression;
      selfClosing: boolean;
      loc: SourceLocation;
    }
  | {
      is: 'component';
      tag: string;
      selfClosing: boolean;
      loc: SourceLocation;
    }
  | { is: 'has-dynamic-features'; tag: string; loc: SourceLocation }
  | { is: 'html'; tag: string; loc: SourceLocation };

function isNamedBlock(element: AST.ElementNode): boolean {
  return element.tag[0] === ':';
}

function classifyNormalElement(
  element: AST.ElementNode,
  currentSymbols: SymbolTable
): ClassifiedElement {
  let open = element.tag.charAt(0);

  let [maybeLocal, ...rest] = element.tag.split('.');
  let isNamedArgument = open === '@';
  let isThisPath = maybeLocal === 'this';

  if (isNamedArgument) {
    return {
      is: 'dynamic-tag',
      selfClosing: element.selfClosing,
      path: {
        type: 'PathExpression',
        data: true,
        parts: [maybeLocal.slice(1), ...rest],
        this: false,
        original: element.tag,
        loc: element.loc,
      },
      loc: element.loc,
    };
  }

  if (isThisPath) {
    return {
      is: 'dynamic-tag',
      selfClosing: element.selfClosing,
      path: {
        type: 'PathExpression',
        data: false,
        parts: rest,
        this: true,
        original: element.tag,
        loc: element.loc,
      },
      loc: element.loc,
    };
  }

  if (currentSymbols.has(maybeLocal)) {
    return {
      is: 'dynamic-tag',
      selfClosing: element.selfClosing,
      path: {
        type: 'PathExpression',
        data: false,
        parts: [maybeLocal, ...rest],
        this: false,
        original: element.tag,
        loc: element.loc,
      },
      loc: element.loc,
    };
  }

  if (open === open.toUpperCase() && open !== open.toLowerCase()) {
    return {
      is: 'component',
      tag: element.tag,
      loc: element.loc,
      selfClosing: element.selfClosing,
    };
  }

  if (isHTMLElement(element)) {
    // we're looking at an element with no component features
    // (no modifiers, no splattributes)
    return { is: 'html', tag: element.tag, loc: element.loc };
  } else {
    return { is: 'has-dynamic-features', tag: element.tag, loc: element.loc };
  }
}

type ClassifiedElementDetails =
  | {
      type: 'Component';
      tag: pass1.Expr;
      selfClosing: boolean;
      hasComponentFeatures: true;
    }
  | {
      type: 'ElementWithDynamicFeatures';
      tag: pass1.SourceSlice;
      hasComponentFeatures: true;
    }
  | {
      type: 'SimpleElement';
      tag: pass1.SourceSlice;
      hasComponentFeatures: false;
    };

function classifiedElementDetails(
  ctx: Context,
  element: AST.ElementNode
): ClassifiedElementDetails {
  let classified = classifyNormalElement(element, ctx.symbols.current);
  switch (classified.is) {
    case 'dynamic-tag': {
      return {
        type: 'Component',
        tag: ctx.visitExpr(classified.path, ExpressionContext.ComponentHead),
        selfClosing: classified.selfClosing,
        hasComponentFeatures: true,
      };
    }

    case 'component': {
      return {
        type: 'Component',
        tag: ctx
          .op(pass1.GetVar, {
            name: ctx.slice(ctx.customizeComponentName(classified.tag)).offsets(null),
            context: ExpressionContext.ComponentHead,
          })
          .loc(classified),
        selfClosing: classified.selfClosing,
        hasComponentFeatures: true,
      };
    }

    // TODO Reject block params for both kinds of HTML elements
    case 'has-dynamic-features': {
      return {
        type: 'ElementWithDynamicFeatures',
        tag: ctx.slice(classified.tag).loc(classified),
        hasComponentFeatures: true,
      };
    }

    case 'html': {
      return {
        type: 'SimpleElement',
        tag: ctx.slice(classified.tag).loc(classified),
        hasComponentFeatures: false,
      };
    }
  }
}

// TODO I transcribed this from the existing code, but the only
// reason this difference matters is that splattributes requires
// a special ElementOperations that merges attributes, so I don't
// know why modifiers matter (it might matter if modifiers become
// allowed to abstract attributes)
function isHTMLElement(element: AST.ElementNode): boolean {
  let { attributes, modifiers } = element;

  if (modifiers.length > 0) {
    return false;
  }

  return !attributes.find((attr) => attr.name === '...attributes');
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
