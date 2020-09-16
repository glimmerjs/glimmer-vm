import { Optional, PresentArray, VariableResolutionContext } from '@glimmer/interfaces';
import { assign } from '@glimmer/util';
import { GlimmerSyntaxError } from '../errors/syntax-error';
import { preprocess, PreprocessOptions } from '../parser/tokenizer-event-handlers';
import { BlockSymbolTable, SymbolTable } from '../symbol-table';
import * as ASTv1 from '../types/nodes-v1';
import { default as buildersV1 } from '../v1-builders';
import * as ASTv2 from './nodes-v2';
import {
  AppendSyntaxContext,
  ARGUMENT,
  AttrValueSyntaxContext,
  BlockSyntaxContext,
  CallSyntaxContextConstructor,
  ComponentSyntaxContent,
  ModifierSyntaxContext,
  SexpSyntaxContext,
  SyntaxContext,
} from './sloppy-context';
import builders, { CallParts } from './v2-builders';

export function normalize(html: string, options: PreprocessOptions = {}): ASTv2.Template {
  let ast = preprocess(html, options);

  let normalizeOptions = assign(
    {
      strictMode: false,
    },
    options
  );

  let top = SymbolTable.top();
  let normalizer = new StatementNormalizer(new BlockContext(normalizeOptions, top));

  return builders.template(
    top,
    ast.body.map((b) => normalizer.normalize(b)),
    ast.loc
  );
}

export interface GlimmerCompileOptions extends PrecompileOptions {
  id?: (src: string) => Optional<string>;
  meta?: object;
  strictMode: boolean;
  customizeComponentName?(input: string): string;
}

/**
 * A `BlockContext` represents the block that a particular AST node is contained inside of.
 *
 * `BlockContext` is aware of template-wide options (such as strict mode), as well as the bindings
 * that are in-scope within that block.
 *
 * Concretely, it has the `GlimmerCompileOptions` and current `SymbolTable`, and provides
 * facilities for working with those options.
 *
 * `BlockContext` is stateless.
 */
class BlockContext<Table extends SymbolTable = SymbolTable> {
  constructor(private readonly options: GlimmerCompileOptions, readonly table: Table) {}

  get strict(): boolean {
    return this.options.strictMode;
  }

  hasBinding(name: string): boolean {
    return this.table.has(name);
  }

  child(blockParams: string[]): BlockContext<BlockSymbolTable> {
    return new BlockContext(this.options, this.table.child(blockParams));
  }

  customizeComponentName(input: string): string {
    if (this.options.customizeComponentName) {
      return this.options.customizeComponentName(input);
    } else {
      return input;
    }
  }
}

/**
 * An `ExpressionNormalizer` normalizes expressions within a block.
 *
 * `ExpressionNormalizer` is stateless.
 */
class ExpressionNormalizer {
  constructor(private block: BlockContext) {}

  /**
   * The `normalize` method takes an arbitrary expression and its original syntax context and
   * normalizes it to an ASTv2 expression.
   *
   * @see {SyntaxContext}
   */
  normalize(expr: ASTv1.Literal, resolution: SyntaxContext): ASTv2.Literal;
  normalize(expr: ASTv1.MinimalPathExpression, resolution: SyntaxContext): ASTv2.PathExpression;
  normalize(expr: ASTv1.SubExpression, resolution: SyntaxContext): ASTv2.SubExpression;
  normalize(expr: ASTv1.Expression, resolution: SyntaxContext): ASTv2.Expression;
  normalize(
    expr: ASTv1.Expression | ASTv1.MinimalPathExpression,
    resolution: SyntaxContext
  ): ASTv2.Expression {
    switch (expr.type) {
      case 'NullLiteral':
      case 'BooleanLiteral':
      case 'NumberLiteral':
      case 'StringLiteral':
      case 'UndefinedLiteral':
        return builders.literal(expr.value, expr.loc);
      case 'PathExpression':
        return builders.path(this.ref(expr.head, resolution), expr.tail, expr.loc);
      case 'SubExpression': {
        return builders.sexp(this.callParts(expr, SexpSyntaxContext), expr.loc);
      }
    }
  }

  /**
   * The `callParts` method takes ASTv1.CallParts as well as a syntax context and normalizes
   * it to an ASTv2 CallParts.
   */
  callParts(parts: ASTv1.CallParts, context: CallSyntaxContextConstructor): CallParts {
    let { path, params, hash } = parts;

    return {
      func: this.normalize(path, new context(parts)),
      params: params.map((p) => this.normalize(p, ARGUMENT)),
      hash: builders.hash(
        hash.pairs.map((p) => builders.pair(p.key, this.normalize(p.value, ARGUMENT), p.loc)),
        hash.loc
      ),
    };
  }

  /**
   * The `ref` method normalizes an `ASTv1.PathHead` into an `ASTv2.VariableReference`.
   * This method is extremely important, because it is responsible for normalizing free
   * variables into an an ASTv2.PathHead *with appropriate context*.
   *
   * The syntax context is originally determined by the syntactic position that this `PathHead`
   * came from, and is ultimately attached to the `ASTv2.VariableReference` here. In ASTv2,
   * the `VariableReference` node bears full responsibility for sloppy mode rules that control
   * the behavior of free variables.
   */
  private ref(head: ASTv1.PathHead, context: SyntaxContext): ASTv2.VariableReference {
    switch (head.type) {
      case 'AtHead':
      case 'ThisHead':
        return head;
      case 'VarHead': {
        if (this.block.hasBinding(head.name)) {
          return builders.localVar(head.name, head.loc);
        } else {
          return builders.freeVar(
            head.name,
            this.block.strict ? VariableResolutionContext.Strict : context.resolution(),
            head.loc
          );
        }
      }
    }
  }
}

/**
 * `TemplateNormalizer` normalizes top-level ASTv1 statements to ASTv2.
 */
class StatementNormalizer {
  constructor(private readonly block: BlockContext) {}

  normalize(node: ASTv1.Statement): ASTv2.Statement {
    switch (node.type) {
      case 'PartialStatement':
        throw new Error(`Handlebars partial syntax ({{> ...}}) is not allowed in Glimmer`);
      case 'BlockStatement':
        return this.BlockStatement(node);
      case 'ElementNode':
        return new ElementNormalizer(this.block).ElementNode(node);
      case 'MustacheStatement':
        return this.MustacheStatement(node);

      // These are the same in ASTv2
      case 'MustacheCommentStatement':
      case 'CommentStatement':
      case 'TextNode':
        return node;
    }
  }

  /**
   * Normalizes an ASTv1.MustacheStatement to an ASTv2.AppendStatement
   */
  MustacheStatement(mustache: ASTv1.MustacheStatement): ASTv2.AppendStatement {
    let { escaped, loc } = mustache;

    // Normalize the call parts in AppendSyntaxContext
    let callParts = this.expr.callParts(
      {
        path: mustache.path,
        params: mustache.params,
        hash: mustache.hash,
      },
      AppendSyntaxContext
    );

    let value =
      callParts.params.length === 0 && callParts.hash.pairs.length === 0
        ? callParts.func
        : builders.sexp(callParts, mustache.loc);

    return builders.append(
      {
        table: this.block.table,
        trusting: !escaped,
        value,
      },
      loc
    );
  }

  /**
   * Normalizes a ASTv1.BlockStatement to an ASTv2.BlockStatement
   */
  BlockStatement(block: ASTv1.BlockStatement): ASTv2.BlockStatement {
    let { program, inverse, loc } = block;

    // Normalize the call parts in BlockSyntaxContext
    let callParts = this.expr.callParts(block, BlockSyntaxContext);

    return builders.blockStatement(
      assign(
        {
          symbols: this.block.table,
          program: this.Block(program),
          inverse: inverse ? this.Block(inverse) : null,
        },
        callParts
      ),
      loc
    );
  }

  Block({ body, loc, blockParams }: ASTv1.Block): ASTv2.Block {
    let child = this.block.child(blockParams);
    let normalizer = new StatementNormalizer(child);

    return builders.block(
      child.table,
      body.map((b) => normalizer.normalize(b)),
      loc
    );
  }

  private get expr(): ExpressionNormalizer {
    return new ExpressionNormalizer(this.block);
  }
}

class ElementNormalizer {
  constructor(private readonly ctx: BlockContext) {}

  /**
   * Normalizes an ASTv1.ElementNode to:
   *
   * - ASTv2.NamedBlock if the tag name begins with `:`
   * - ASTv2.Component if the tag name matches the component heuristics
   * - ASTv2.SimpleElement if the tag name doesn't match the component heuristics
   *
   * A tag name represents a component if:
   *
   * - it begins with `@`
   * - it is exactly `this` or begins with `this.`
   * - the part before the first `.` is a reference to an in-scope variable binding
   * - it begins with an uppercase character
   */
  ElementNode(element: ASTv1.ElementNode): ASTv2.ElementNode {
    let { tag, selfClosing, comments, loc } = element;

    let [tagHead, ...rest] = tag.split('.');

    // the head, attributes and modifiers are in the current scope
    let path = this.classifyTag(tagHead, rest, element.loc);
    let attributes = element.attributes.map((a) => this.attr(a));
    let modifiers = element.modifiers.map((m) => this.modifier(m));

    // the element's block params are in scope for the children
    let child = this.ctx.child(element.blockParams);
    let normalizer = new StatementNormalizer(child);

    let children = element.children.map((s) => normalizer.normalize(s));
    let hasNamedBlocks = children.some((c) => c.type === 'NamedBlock');
    let namedBlocks = children.filter((c) => c.type === 'NamedBlock');

    let el = builders.element({
      selfClosing,
      attributes,
      modifiers,
      comments,
    });

    if (path === 'ElementHead') {
      if (hasNamedBlocks) {
        throw new GlimmerSyntaxError(`An HTML element may not have named blocks`, element.loc);
      }

      if (tag[0] === ':') {
        return el.named(tag.slice(1), children, child.table, loc);
      } else {
        return el.simple(tag, children, child.table);
      }
    }

    if (element.selfClosing) {
      return el.selfClosingComponent(path, loc);
    } else if (hasNamedBlocks) {
      return el.componentWithNamedBlocks(path, namedBlocks as PresentArray<ASTv2.NamedBlock>, loc);
    } else {
      return el.componentWithDefaultBlock(path, children, child.table, loc);
    }
  }

  private modifier(m: ASTv1.ElementModifierStatement): ASTv2.ElementModifierStatement {
    // Normalize the call parts in ModifierSyntaxContext
    let callParts = this.expr.callParts(m, ModifierSyntaxContext);
    return builders.modifier(callParts, m.loc);
  }

  /**
   * This method handles attribute values that are curlies, as well as curlies nested inside of
   * interpolations:
   *
   * ```hbs
   * <a href={{url}} />
   * <a href="{{url}}.html" />
   * ```
   */
  private mustacheAttr(mustache: ASTv1.MustacheStatement): ASTv2.InternalExpression {
    // Normalize the call parts in AttrValueSyntaxContext
    let sexp = builders.sexp(this.expr.callParts(mustache, AttrValueSyntaxContext), mustache.loc);

    // If there are no params or hash, just return the function part as its own expression
    if (sexp.params.length === 0 && sexp.hash.pairs.length === 0) {
      return sexp.func;
    } else {
      return sexp;
    }
  }

  /**
   * attrPart is the narrowed down list of valid attribute values that are also
   * allowed as a concat part (you can't nest concats).
   */
  private attrPart(
    part: ASTv1.MustacheStatement | ASTv1.TextNode
  ): { expr: ASTv2.InternalExpression; trusting: boolean } {
    switch (part.type) {
      case 'MustacheStatement':
        return { expr: this.mustacheAttr(part), trusting: !part.escaped };
      case 'TextNode':
        return { expr: builders.literal(part.chars, part.loc), trusting: true };
    }
  }

  private attrValue(
    part: ASTv1.MustacheStatement | ASTv1.TextNode | ASTv1.ConcatStatement
  ): { expr: ASTv2.InternalExpression; trusting: boolean } {
    switch (part.type) {
      case 'ConcatStatement': {
        let parts = part.parts.map((p) => this.attrPart(p).expr);
        return {
          expr: builders.interpolate(parts, part.loc),
          trusting: false,
        };
      }
      default:
        return this.attrPart(part);
    }
  }

  private attr(m: ASTv1.AttrNode): ASTv2.AttrNode {
    let value = this.attrValue(m.value);
    return builders.attr({ name: m.name, value: value.expr, trusting: value.trusting }, m.loc);
  }

  /**
   * This function classifies the head of an ASTv1.Element into an ASTv2.PathHead (if the
   * element is a component) or `'ElementHead'` (if the element is a simple element).
   *
   * Rules:
   *
   * 1. If the variable is an `@arg`, return an `AtHead`
   * 2. If the variable is `this`, return a `ThisHead`
   * 3. If the variable is in the current scope, return a `LocalVarHead`
   * 4. If the tag name is a path and the variable is not in the current scope, Syntax Error
   * 5. If the variable is uppercase:
   *   a. if strict mode, return a FreeVar(Strict)
   *   b. otherwise, return a FreeVar(ResolveAsComponentHead)
   * 6. Othwewise, return `'ElementHead'`
   */
  private classifyTag(
    variable: string,
    tail: string[],
    loc: ASTv1.SourceLocation
  ): ASTv2.Expression | 'ElementHead' {
    let uppercase = isUpperCase(variable);
    let inScope = this.ctx.hasBinding(variable);

    // Since the parser handed us the HTML element name as a string, we need
    // to convert it into an ASTv1 path so it can be processed using the
    // expression normalizer.
    let isComponent = variable[0] === '@' || variable === 'this' || inScope || uppercase;

    if (isComponent) {
      // If the component name is uppercase, the variable is not in scope,
      // and the template is not in strict mode, run the optional
      // `customizeComponentName` function provided as an option to the
      // precompiler.
      if (!this.ctx.strict && uppercase && !inScope) {
        variable = this.ctx.customizeComponentName(variable);
      }

      let path = buildersV1.fullPath(buildersV1.head(variable), tail);

      return new ExpressionNormalizer(this.ctx).normalize(path, ComponentSyntaxContent);
    }

    // If the tag name wasn't a valid component but contained a `.`, it's
    // a syntax error.
    if (tail.length > 0) {
      throw new GlimmerSyntaxError(
        `You used ${variable}.${tail.join('.')} as a tag name, but ${variable} is not in scope`,
        loc
      );
    }

    return 'ElementHead';
  }

  private get expr(): ExpressionNormalizer {
    return new ExpressionNormalizer(this.ctx);
  }
}

function isUpperCase(tag: string): boolean {
  return tag[0] === tag[0].toUpperCase() && tag[0] !== tag[0].toLowerCase();
}
