import { ExpressionContext, Option } from '@glimmer/interfaces';
import { AST, isLiteral, SourceLocation } from '@glimmer/syntax';
import { assign, PresentArray } from '@glimmer/util';
import * as pass1 from '../../pass1/ops';
import { UnlocatedOp } from '../../shared/op';
import { BlockSymbolTable, SymbolTable } from '../../shared/symbol-table';
import { attr } from '../utils/attrs';
import { buildArgs, buildHash, buildParams } from '../utils/builders';
import { Context, StatementVisitor } from '../context';
import { assertIsSimpleHelper, isHelperInvocation } from '../utils/is-node';
import { BLOCK_KEYWORDS, EXPR_KEYWORDS, STATEMENT_KEYWORDS } from '../keywords';

class Pass0Statements implements StatementVisitor {
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

  ElementNode(element: AST.ElementNode, ctx: Context): pass1.Statement[] {
    return ctx.withBlock(element, (child, parent) => {
      let classify = classifyElement(element, parent, child);

      // are `@args` allowed?
      let hasComponentFeatures =
        classify.is === 'component' ||
        classify.is === 'has-dynamic-features' ||
        classify.is === 'dynamic-tag';

      if (classify.is === 'named-block') {
        return ctx.ops(
          ctx
            .op(pass1.OpenNamedBlock, {
              tag: ctx.slice(element.tag).loc(element),
              symbols: child,
            })
            .loc(element),
          ctx.mapIntoStatements(element.children, (stmt) => ctx.visitStmt(stmt)),
          ctx.op(pass1.CloseNamedBlock).loc(element)
        );
      } else {
        return ctx.ops(
          openElementOp(ctx, classify),
          ctx.mapIntoStatements(attributes(element.attributes), (statement) =>
            attr(ctx, statement, hasComponentFeatures, element)
          ),
          ctx.mapIntoStatements(element.modifiers, (statement) => modifier(ctx, statement)),
          ctx.ops(
            ctx.op(pass1.FlushElement, { symbols: child }).loc(element),
            ctx.mapIntoStatements(element.children, (stmt) => ctx.visitStmt(stmt)),
            ctx.op(pass1.CloseElementBlock).loc(element)
          ),
          closeElementOp(ctx, classify)
        );
      }
    });
  }

  MustacheCommentStatement(): [] {
    return [];
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
          .expr(
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
    return ctx
      .op(pass1.AppendTextNode, {
        value: ctx.expr(pass1.Literal, { type: 'StringLiteral', value: text.chars }).loc(text),
      })
      .loc(text);
  }

  CommentStatement(comment: AST.CommentStatement, ctx: Context): pass1.Statement {
    return ctx
      .op(pass1.AppendComment, {
        value: ctx.slice(comment.value).loc(comment),
      })
      .loc(comment);
  }
}

export const STATEMENTS: StatementVisitor = new Pass0Statements();

function modifier(ctx: Context, modifier: AST.ElementModifierStatement): pass1.Statement[] {
  if (isHelperInvocation(modifier)) {
    assertIsSimpleHelper(modifier, modifier.loc, 'modifier');
  }

  return ctx.ops(
    ctx
      .op(pass1.Modifier, {
        head: ctx.visitExpr(modifier.path, ExpressionContext.ModifierHead),
        params: buildParams(ctx, { path: modifier.path, params: modifier.params }),
        hash: buildHash(ctx, modifier.hash),
      })
      .loc(modifier)
  );
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
      symbols: BlockSymbolTable;
      selfClosing: boolean;
      loc: SourceLocation;
    }
  | {
      is: 'component';
      tag: string;
      symbols: BlockSymbolTable;
      selfClosing: boolean;
      loc: SourceLocation;
    }
  | { is: 'has-dynamic-features'; tag: string; loc: SourceLocation }
  | { is: 'named-block' }
  | { is: 'html'; tag: string; loc: SourceLocation };

function classifyElement(
  element: AST.ElementNode,
  currentSymbols: SymbolTable,
  childSymbols: BlockSymbolTable
): ClassifiedElement {
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
      symbols: childSymbols,
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
      symbols: childSymbols,
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
      symbols: childSymbols,
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
      symbols: childSymbols,
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

function openElementOp(
  ctx: Context,
  classified: Exclude<ClassifiedElement, { is: 'named-block' }>
): pass1.Statement {
  switch (classified.is) {
    case 'dynamic-tag': {
      const head = classified.path;

      return ctx
        .op(pass1.OpenComponent, {
          tag: ctx.visitExpr(head, ExpressionContext.ComponentHead),
          symbols: classified.symbols,
          selfClosing: classified.selfClosing,
        })
        .loc(head);
    }

    case 'component': {
      return ctx
        .op(pass1.OpenComponent, {
          tag: ctx
            .expr(pass1.GetVar, {
              name: ctx.slice(ctx.customizeComponentName(classified.tag)).offsets(null),
              context: ExpressionContext.ComponentHead,
            })
            .loc(classified),
          symbols: classified.symbols,
          selfClosing: classified.selfClosing,
        })
        .loc(classified);
    }

    // TODO: Reject block params for both kinds of HTML elements
    case 'has-dynamic-features':
      return ctx
        .op(pass1.OpenElementWithDynamicFeatures, {
          tag: ctx.slice(classified.tag).loc(classified),
        })
        .loc(classified);

    case 'html':
      return ctx
        .op(pass1.OpenSimpleElement, {
          tag: ctx.slice(classified.tag).loc(classified),
        })
        .loc(classified);
  }
}

function closeElementOp(
  ctx: Context,
  classified: Exclude<ClassifiedElement, { is: 'named-block' }>
): pass1.Statement {
  switch (classified.is) {
    case 'dynamic-tag':
    case 'component':
      return ctx.op(pass1.CloseComponent).loc(classified);

    case 'has-dynamic-features':
    case 'html':
      return ctx.op(pass1.CloseElement).loc(classified);
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

function attributes(attrs: AST.AttrNode[]): AST.AttrNode[] {
  let out = [];
  let typeAttr: Option<AST.AttrNode> = null;

  for (let attr of attrs) {
    if (attr.name === 'type') {
      typeAttr = attr;
    } else {
      out.push(attr);
    }
  }

  if (typeAttr) {
    out.push(typeAttr);
  }

  return out;
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
