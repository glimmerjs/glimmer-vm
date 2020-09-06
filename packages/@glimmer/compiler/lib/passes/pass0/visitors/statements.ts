import { ExpressionContext, Option, PresentArray } from '@glimmer/interfaces';
import { AST, GlimmerSyntaxError, isLiteral, SourceLocation } from '@glimmer/syntax';
import { assign, ifPresent, isPresent } from '@glimmer/util';
import * as pass1 from '../../pass1/ops';
import { UnlocatedOp } from '../../shared/op';
import { SymbolTable } from '../../shared/symbol-table';
import { Context, Pass1Stmt, VisitorInterface } from '../context';
import { BLOCK_KEYWORDS, EXPR_KEYWORDS, STATEMENT_KEYWORDS } from '../keywords';
import * as attrs from '../utils/attrs';
import { buildArgs, buildHash, buildParams } from '../utils/builders';
import { assertIsSimpleHelper, isHelperInvocation } from '../utils/is-node';

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
    let parent = ctx.symbols.current;
    let classified = classifyElement(element, parent);

    if (classified.is === 'named-block') {
      return ctx.withBlock(element, (child) => {
        return ctx
          .op(pass1.TemporaryNamedBlock, {
            name: ctx.slice(element.tag.slice(1)).loc(element),
            table: child,
            body: ctx.mapIntoOps(element.children, (stmt) => ctx.visitStmt(stmt)),
          })
          .loc(element);
      });
    } else {
      let elementDetails = classifiedElementDetails(ctx, classified);

      let result = attributes(element.attributes, elementDetails.type === 'Component');

      if (result.type === 'error') {
        throw new GlimmerSyntaxError(
          `${result.attr.name} is not a valid attribute name. @arguments are only allowed on components, but the tag for this element (\`${element.tag}\`) is a regular, non-component HTML element.`,
          result.attr.loc
        );
      }

      let { attrs: attrNodes, args: argNodes } = result;

      let outAttrs: pass1.ElementParameter[] = attrNodes.map((a) =>
        attrs.attr(ctx, a, elementDetails.hasComponentFeatures, element)
      );
      let outArgPairs = argNodes.map((a) =>
        attrs.arg(ctx, a, elementDetails.hasComponentFeatures, element)
      );
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
        throw new GlimmerSyntaxError(
          `Named blocks are only allowed inside a component`,
          element.loc
        );
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
          let { type, ...rest } = elementDetails;

          let blocks =
            classifiedBlock.type === 'named-block'
              ? ctx.op(pass1.NamedBlocks, { blocks: [classifiedBlock.block] }).loc(element)
              : ctx.op(pass1.NamedBlocks, { blocks: classifiedBlock.blocks }).loc(element);

          return ctx
            .op(pass1.Component, assign(rest, { params: elementParams, args: outArgs, blocks }))
            .loc(element);
        }
      }
    }
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

type ClassifiedBody =
  | {
      type: 'named-block';
      block: pass1.NamedBlock;
    }
  | {
      type: 'named-blocks';
      blocks: PresentArray<pass1.NamedBlock>;
    };

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
  | { is: 'named-block' }
  | { is: 'html'; tag: string; loc: SourceLocation };

function classifyElement(element: AST.ElementNode, currentSymbols: SymbolTable): ClassifiedElement {
  let open = element.tag.charAt(0);

  let [maybeLocal, ...rest] = element.tag.split('.');
  let isNamedArgument = open === '@';
  let isThisPath = maybeLocal === 'this';

  if (isNamedBlock(element)) {
    return { is: 'named-block' };
  }

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
  classified: Exclude<ClassifiedElement, { is: 'named-block' }>
): ClassifiedElementDetails {
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

function mustacheContext(body: AST.Expression): ExpressionContext {
  if (body.type === 'PathExpression') {
    if (body.parts.length > 1 || body.data) {
      return ExpressionContext.Expression;
    } else {
      return ExpressionContext.AppendSingleId;
    }
  } else {
    return ExpressionContext.Expression;
  }
}

function isNamedBlock(element: AST.ElementNode): boolean {
  return element.tag[0] === ':';
}
