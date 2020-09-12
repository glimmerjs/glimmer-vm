import { ExpressionContext, PresentArray } from '@glimmer/interfaces';
import { assertPresent, assign, NonemptyStack } from '@glimmer/util';
import { GlimmerSyntaxError } from './errors/syntax-error';
import { preprocess, PreprocessOptions } from './parser/tokenizer-event-handlers';
import { BlockSymbolTable, SymbolTable } from './symbol-table';
import * as ASTv1 from './types/nodes-v1';
import * as ASTv2 from './types/nodes-v2';
import builders from './v2-builders';

export function normalize(html: string, options: PreprocessOptions = {}): ASTv2.Template {
  let ast = preprocess(html, options);
  return annotate(ast);
}

/**
 * The purpose of the annotation step is twofold:
 *
 * - add `ProgramSymbolTable` to Template and `BlockSymbolTable` to
 *   `Block` and `ElementNode`
 * - split `ElementNode` into NamedBlock, SimpleElement and Component
 */

/**
 * The `'Curly'` context lets `NormalizeExpr` disambiguate:
 *
 * - `{{<literal>}}`
 * - `{{name}}` -> `name` is `ExpressionContent.Ambiguous`
 * - `{{name.path}}` -> `name` is `ExpressionContext.WithoutResolver`
 * - `{{name <args>}}` -> `name` is `ExpressionContext.ResolveAsCallHead`
 * - `{{name.path <args>}} `name` is `ExpressionContext.WithoutResolver`
 *
 * The syntactic rules are the same for:
 *
 * - append
 * - attribute value
 * - argument value
 *
 * Modifier heads are always evaluated with `ExpressionContext.ModifierHead`
 *
 * Block heads are always evaluated with `ExpressionContext.BlockHead`
 *
 * Component heads are always evaluated with `ExpressionContext.ComponentHead`
 */
type NormalizeExprContext = ExpressionContext | 'AppendOrAttr';

class NormalizeExpr {
  constructor(private context: NormalizeExprContext, private symbols: SymbolTable) {}

  visit(expr: ASTv1.Expression, context: NormalizeExprContext = this.context): ASTv2.Expression {
    if (context !== this.context) {
      return new NormalizeExpr(context, this.symbols).visit(expr);
    }

    switch (expr.type) {
      case 'NullLiteral':
      case 'BooleanLiteral':
      case 'NumberLiteral':
      case 'StringLiteral':
      case 'UndefinedLiteral':
        return this.literal(expr.value, expr.loc);
      case 'PathExpression':
        return this.PathExpression(expr);
      case 'SubExpression':
        return this.SubExpression(expr);
    }
  }

  private literal(
    value: string | number | boolean | null | undefined,
    loc: ASTv1.SourceLocation
  ): ASTv2.Literal {
    return {
      type: 'Literal',
      kind:
        value === null ? 'null' : (typeof value as 'string' | 'number' | 'boolean' | 'undefined'),
      value,
      loc,
    };
  }

  PathExpression(path: ASTv1.PathExpression): ASTv2.Expression {
    let head = mapPathHead(path, this.context, this.symbols);

    return {
      type: 'PathExpression',
      head,
      tail: path.tail,
      loc: path.loc,
    };
  }

  SubExpression({ path, params, hash, loc }: ASTv1.SubExpression): ASTv2.Expression {
    return assign(
      {
        type: 'SubExpression',
        loc,
      } as const,
      this.call({ path, params, hash }, ExpressionContext.ResolveAsCallHead)
    );
  }

  head(
    expr: ASTv1.Expression,
    hasArgs: boolean,
    context: NormalizeExprContext = this.context
  ): ASTv2.Expression {
    if (hasArgs && context === 'AppendOrAttr') {
      return this.visit(expr, ExpressionContext.ResolveAsCallHead);
    } else {
      return this.visit(expr, context);
    }
  }

  call(
    {
      path,
      params,
      hash,
    }: {
      path: ASTv1.Expression;
      params: ASTv1.Expression[];
      hash: ASTv1.Hash;
    },
    context: NormalizeExprContext = this.context
  ): {
    path: ASTv2.Expression;
    params: ASTv2.Expression[];
    hash: ASTv2.Hash;
  } {
    return {
      path: this.head(path, hasArgs({ params, hash }), context),
      params: params.map((p) => this.visit(p, ExpressionContext.WithoutResolver)),
      hash: {
        type: 'Hash',
        pairs: hash.pairs.map((p) => ({
          type: 'HashPair',
          key: p.key,
          value: this.visit(p.value, ExpressionContext.WithoutResolver),
          loc: p.loc,
        })),
        loc: hash.loc,
      },
    };
  }
}

class NormalizeToAstV2 {
  private top = SymbolTable.top();
  private stack = new NonemptyStack<SymbolTable>([this.top]);

  template(node: ASTv1.Template): ASTv2.Template {
    return this[node.type](node);
  }

  visitStmt(node: ASTv1.Statement): ASTv2.Statement {
    switch (node.type) {
      case 'PartialStatement':
        throw new Error(`Handlebars partial syntax ({{> ...}}) is not allowed in Glimmer`);
      case 'BlockStatement':
        return this.BlockStatement(node);
      case 'CommentStatement':
        return this.CommentStatement(node);
      case 'ElementNode':
        return this.ElementNode(node);
      case 'MustacheCommentStatement':
        return this.MustacheCommentStatement(node);
      case 'MustacheStatement':
        return this.MustacheStatement(node);
      case 'TextNode':
        return this.TextNode(node);
    }
  }

  head(node: ASTv1.Expression, hasArgs: boolean, context: NormalizeExprContext): ASTv2.Expression {
    return new NormalizeExpr(context, this.stack.current).head(node, hasArgs);
  }

  call(
    call: {
      path: ASTv1.Expression;
      params: ASTv1.Expression[];
      hash: ASTv1.Hash;
    },
    context: NormalizeExprContext
  ): {
    path: ASTv2.Expression;
    params: ASTv2.Expression[];
    hash: ASTv2.Hash;
  } {
    return new NormalizeExpr(context, this.stack.current).call(call);
  }

  withBlock<T>(
    blockParams: string[],
    callback: (table: BlockSymbolTable, parent: SymbolTable) => T
  ): T {
    let parent = this.stack.current;
    let child = parent.child(blockParams);
    this.stack.push(child);

    try {
      return callback(child, parent);
    } finally {
      this.stack.pop();
    }
  }

  // STATEMENTS //

  MustacheStatement({
    path,
    params,
    hash,
    escaped,
    strip,
    loc,
  }: ASTv1.MustacheStatement): ASTv2.Statement {
    return assign(
      {
        type: 'MustacheStatement',
        symbols: this.stack.current,
        escaped,
        strip,
        loc,
      } as const,
      this.call({ path, params, hash }, 'AppendOrAttr')
    );
  }

  BlockStatement({
    path,
    params,
    hash,
    program,
    inverse,
    openStrip,
    closeStrip,
    inverseStrip,
    chained,
    loc,
  }: ASTv1.BlockStatement): ASTv2.BlockStatement {
    return assign(
      {
        type: 'BlockStatement',
        symbols: this.stack.current,
        openStrip,
        inverseStrip,
        closeStrip,
        program: this.Block(program),
        inverse: inverse ? this.Block(inverse) : null,
        chained,
        loc,
      } as const,
      this.call({ path, params, hash }, ExpressionContext.ResolveAsBlockHead)
    );
  }

  MustacheCommentStatement(input: ASTv1.MustacheCommentStatement): ASTv2.Statement {
    return input;
  }

  TextNode(input: ASTv1.TextNode): ASTv2.Statement {
    return input;
  }

  CommentStatement(input: ASTv1.CommentStatement): ASTv2.Statement {
    return input;
  }

  Template({ body, chained, loc }: ASTv1.Template): ASTv2.Template {
    return {
      type: 'Template',
      symbols: this.top,
      body: body.map((b) => this.visitStmt(b)),
      chained,
      loc,
    };
  }

  Block({ body, chained, loc, blockParams }: ASTv1.Block): ASTv2.Block {
    return this.withBlock(blockParams, (child) => {
      return {
        type: 'Block',
        symbols: child,
        body: body.map((b) => this.visitStmt(b)),
        chained,
        loc,
      };
    });
  }

  ElementNode(element: ASTv1.ElementNode): ASTv2.ElementNode {
    // this code is parsing the expression at the head of component, which
    // is not done by @glimmer/syntax, and notably is scope-sensitive.

    let { tag, selfClosing, comments, loc } = element;

    let [maybeLocal, ...rest] = (tag as string).split('.');
    let head = classifyTag(maybeLocal, rest, this.stack.current, element.loc);

    let attributes = element.attributes.map((a) => this.attr(a));
    let modifiers = element.modifiers.map((m) => this.modifier(m));
    return this.withBlock(element.blockParams, (child) => {
      let children = element.children.map((s) => this.visitStmt(s));
      let hasNamedBlocks = children.some((c) => c.type === 'NamedBlock');
      let namedBlocks = children.filter((c) => c.type === 'NamedBlock');

      let el = builders.element({
        selfClosing,
        attributes,
        modifiers,
        comments,
      });

      if (head === 'ElementHead') {
        if (hasNamedBlocks) {
          throw new GlimmerSyntaxError(`An HTML element may not have named blocks`, element.loc);
        }

        if (tag[0] === ':') {
          return el.named(tag.slice(1), children, child, loc);
        } else {
          return el.simple(tag, children, child);
        }
      }

      let path = builders.path(head, rest);

      if (hasNamedBlocks) {
        return el.componentWithNamedBlocks(
          path,
          namedBlocks as PresentArray<ASTv2.NamedBlockNode>,
          loc
        );
      } else {
        return el.componentWithDefaultBlock(path, children, child, loc);
      }
    });
  }

  private modifier(m: ASTv1.ElementModifierStatement): ASTv2.ElementModifierStatement {
    return assign(
      {
        type: 'ElementModifierStatement',
        loc: m.loc,
      } as const,
      this.call(m, ExpressionContext.ResolveAsModifierHead)
    );
  }

  private mustacheAttr(mustache: ASTv1.MustacheStatement): ASTv2.Expression {
    if (mustache.params.length === 0 && mustache.hash.pairs.length === 0) {
      return assign(this.head(mustache.path, hasArgs(mustache), 'AppendOrAttr'), {
        loc: mustache.loc,
      });
    } else {
      return assign(
        {
          type: 'SubExpression',
          loc: mustache.loc,
        } as const,
        this.call(mustache, 'AppendOrAttr')
      );
    }
  }

  private textAttr(text: ASTv1.TextNode): ASTv2.Expression {
    return {
      type: 'Literal',
      kind: 'string',
      value: text.chars,
      loc: text.loc,
    };
  }

  /**
   * attrPart is the narrowed down list of valid attribute values that are also
   * allowed as a concat part (you can't nest concats).
   */
  private attrPart(
    part: ASTv1.MustacheStatement | ASTv1.TextNode
  ): { expr: ASTv2.Expression; trusting: boolean } {
    switch (part.type) {
      case 'MustacheStatement':
        return { expr: this.mustacheAttr(part), trusting: !part.escaped };
      case 'TextNode':
        return { expr: this.textAttr(part), trusting: true };
    }
  }

  private attrValue(
    part: ASTv1.MustacheStatement | ASTv1.TextNode | ASTv1.ConcatStatement
  ): { expr: ASTv2.Expression; trusting: boolean } {
    switch (part.type) {
      case 'ConcatStatement': {
        let parts = part.parts.map((p) => this.attrPart(p).expr);
        return {
          expr: {
            type: 'Interpolate',
            parts: assertPresent(parts),
            loc: part.loc,
          },
          trusting: false,
        };
      }
      default:
        return this.attrPart(part);
    }
  }

  private attr(m: ASTv1.AttrNode): ASTv2.AttrNode {
    let value = this.attrValue(m.value);

    return {
      type: 'AttrNode',
      name: m.name,
      value: value.expr,
      trusting: value.trusting,
      loc: m.loc,
    };
  }
}

function hasArgs(expr: { params: ASTv1.Expression[]; hash: ASTv1.Hash }): boolean {
  return expr.params.length > 0 || expr.hash.pairs.length > 0;
}

export function annotate(ast: ASTv1.Template): ASTv2.Template {
  return new NormalizeToAstV2().template(ast);
}

function classifyTag(
  variable: string,
  tail: string[],
  currentSymbols: SymbolTable,
  loc: ASTv1.SourceLocation
): ASTv2.PathHead | 'ElementHead' {
  // if (kind === 'FreeVariable') {
  //   head = builders.freeVar(maybeLocal, ExpressionContext.ResolveAsComponentHead);
  // } else if (kind === 'ThisVariable') {
  //   head = builders.this();
  // } else if (kind === 'LocalVariable') {
  //   head = builders.localVar(maybeLocal);
  // } else if (kind === 'AtVariable') {
  //   head = builders.at(name);
  // } else {
  //   assertNever(kind);
  // }

  if (variable[0] === '@') {
    return builders.at(variable);
  } else if (variable === 'this') {
    return builders.this();
  } else if (currentSymbols.has(variable)) {
    return builders.localVar(variable);
  } else if (tail.length > 0) {
    throw new GlimmerSyntaxError(`invalid component name ${variable}.${tail.join('.')}`, loc);
    return builders.freeVar(variable, ExpressionContext.WithoutResolver);
  } else if (isUpperCase(variable)) {
    return builders.freeVar(variable, ExpressionContext.ResolveAsComponentHead);
  } else {
    return 'ElementHead';
  }
}

export function isUpperCase(tag: string): boolean {
  return tag[0] === tag[0].toUpperCase() && tag[0] !== tag[0].toLowerCase();
}

function mapPathHead(
  { head, tail }: ASTv1.PathExpression,
  context: NormalizeExprContext,
  table: SymbolTable
): ASTv2.PathHead {
  switch (head.type) {
    case 'AtHead':
    case 'ThisHead':
      return head;
    case 'VarHead': {
      if (table.has(head.name)) {
        return {
          type: 'LocalVarHead',
          name: head.name,
          loc: head.loc,
        };
      } else if (tail.length > 0) {
        return {
          type: 'FreeVarHead',
          name: head.name,
          context: ExpressionContext.WithoutResolver,
          loc: head.loc,
        };
      } else {
        return {
          type: 'FreeVarHead',
          name: head.name,
          context: context === 'AppendOrAttr' ? ExpressionContext.Ambiguous : context,
          loc: head.loc,
        };
      }
    }
  }
}
