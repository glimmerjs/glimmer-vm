import { Optional, PresentArray } from '@glimmer/interfaces';
import { assert, assign, isPresent } from '@glimmer/util';
import { GlimmerSyntaxError } from '../errors/syntax-error';
import Printer from '../generation/printer';
import { preprocess, PreprocessOptions } from '../parser/tokenizer-event-handlers';
import { SourceLocation, SYNTHETIC } from '../source/location';
import { BlockSymbolTable, ProgramSymbolTable, SymbolTable } from '../symbol-table';
import * as ASTv1 from '../types/nodes-v1';
import { default as buildersV1 } from '../v1-builders';
import {
  AppendSyntaxContext,
  ARGUMENT,
  AttrValueSyntaxContext,
  BlockSyntaxContext,
  ComponentSyntaxContext,
  ModifierSyntaxContext,
  Resolution,
  SexpSyntaxContext,
} from './loose-resolution';
import * as ASTv2 from './nodes-v2';
import { GlimmerComment, HtmlComment, HtmlText, SourceSlice } from './objects';
import { FreeVarResolution, STRICT_RESOLUTION } from './objects/refs';
import builders, { BuildElement, CallParts } from './v2-builders';

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

  return new TemplateChildren(
    ast.loc,
    ast.body.map((b) => normalizer.normalize(b))
  ).assertTemplate(top);
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
export class BlockContext<Table extends SymbolTable = SymbolTable> {
  constructor(private readonly options: GlimmerCompileOptions, readonly table: Table) {}

  get strict(): boolean {
    return this.options.strictMode;
  }

  resolutionFor<N extends ASTv1.CallNode | ASTv1.PathExpression>(
    node: N,
    resolution: Resolution<N>
  ): { resolution: FreeVarResolution } | { resolution: 'error'; path: string; head: string } {
    if (this.strict) {
      return { resolution: STRICT_RESOLUTION };
    }

    if (this.isFreeVar(node)) {
      let r = resolution(node);

      if (r === null) {
        return {
          resolution: 'error',
          path: printPath(node),
          head: printHead(node),
        };
      }

      return { resolution: r };
    } else {
      return { resolution: STRICT_RESOLUTION };
    }
  }

  private isFreeVar(callee: ASTv1.CallNode | ASTv1.PathExpression): boolean {
    if (callee.type === 'PathExpression') {
      if (callee.head.type !== 'VarHead') {
        return false;
      }

      return !this.table.has(callee.head.name);
    } else if (callee.path.type === 'PathExpression') {
      return this.isFreeVar(callee.path);
    } else {
      return false;
    }
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
  normalize(expr: ASTv1.Literal, resolution: FreeVarResolution): ASTv2.LiteralExpression;
  normalize(expr: ASTv1.MinimalPathExpression, resolution: FreeVarResolution): ASTv2.PathExpression;
  normalize(expr: ASTv1.SubExpression, resolution: FreeVarResolution): ASTv2.CallExpression;
  normalize(expr: ASTv1.Expression, resolution: FreeVarResolution): ASTv2.Expression;
  normalize(
    expr: ASTv1.Expression | ASTv1.MinimalPathExpression,
    resolution: FreeVarResolution
  ): ASTv2.Expression {
    switch (expr.type) {
      case 'NullLiteral':
      case 'BooleanLiteral':
      case 'NumberLiteral':
      case 'StringLiteral':
      case 'UndefinedLiteral':
        return builders.literal(expr.value, expr.loc);
      case 'PathExpression':
        return builders.path(
          this.ref(expr.head, resolution),
          expr.tail.map(
            (chars) =>
              new SourceSlice({
                // TODO get this right
                loc: SYNTHETIC,
                chars: chars,
              })
          ),
          expr.loc
        );
      case 'SubExpression': {
        let resolution = this.block.resolutionFor(expr, SexpSyntaxContext);

        if (resolution.resolution === 'error') {
          throw new GlimmerSyntaxError(
            `You attempted to invoke a path (\`${resolution.path}\`) but ${resolution.head} was not in scope`,
            expr.loc
          );
        }

        return builders.sexp(this.callParts(expr, resolution.resolution), expr.loc);
      }
    }
  }

  /**
   * The `callParts` method takes ASTv1.CallParts as well as a syntax context and normalizes
   * it to an ASTv2 CallParts.
   */
  callParts(parts: ASTv1.CallParts, context: FreeVarResolution): CallParts {
    let { path, params, hash } = parts;

    let positional = builders.positional(
      params.map((p) => this.normalize(p, ARGUMENT)),
      SYNTHETIC
    );

    let named = builders.named(
      hash.pairs.map((p) =>
        builders.namedEntry(
          // TODO get loc right
          new SourceSlice({ chars: p.key, loc: SYNTHETIC }),
          this.normalize(p.value, ARGUMENT),
          p.loc
        )
      )
    );

    return {
      callee: this.normalize(path, context),
      args: builders.args(positional, named),
    };
  }

  /**
   * The `ref` method normalizes an `ASTv1.PathHead` into an `ASTv2.VariableReference`.
   * This method is extremely important, because it is responsible for normalizing free
   * variables into an an ASTv2.PathHead *with appropriate context*.
   *
   * The syntax context is originally determined by the syntactic position that this `PathHead`
   * came from, and is ultimately attached to the `ASTv2.VariableReference` here. In ASTv2,
   * the `VariableReference` node bears full responsibility for loose mode rules that control
   * the behavior of free variables.
   */
  private ref(head: ASTv1.PathHead, resolution: FreeVarResolution): ASTv2.VariableReference {
    switch (head.type) {
      case 'ThisHead':
        return builders.self(head.loc);
      case 'AtHead':
        return builders.at(head.name, head.loc);
      case 'VarHead': {
        if (this.block.hasBinding(head.name)) {
          return builders.localVar(head.name, head.loc);
        } else {
          return builders.freeVar(
            builders.slice(head.name),
            this.block.strict ? STRICT_RESOLUTION : resolution,
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

  normalize(node: ASTv1.Statement): ASTv2.ContentNode | ASTv2.NamedBlock {
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
        return this.MustacheCommentStatement(node);

      case 'CommentStatement':
        return new HtmlComment({
          loc: node.loc,
          text: new SourceSlice({
            loc: node.loc,
            chars: node.value,
          }),
        });

      case 'TextNode':
        return new HtmlText({
          loc: node.loc,
          chars: node.chars,
        });
    }
  }

  MustacheCommentStatement(node: ASTv1.MustacheCommentStatement): ASTv2.GlimmerComment {
    return new GlimmerComment({
      loc: node.loc,
      text: new SourceSlice({
        loc: node.loc,
        chars: node.value,
      }),
    });
  }

  /**
   * Normalizes an ASTv1.MustacheStatement to an ASTv2.AppendStatement
   */
  MustacheStatement(mustache: ASTv1.MustacheStatement): ASTv2.AppendContent {
    let { escaped, loc } = mustache;

    // Normalize the call parts in AppendSyntaxContext
    let callParts = this.expr.callParts(
      {
        path: mustache.path,
        params: mustache.params,
        hash: mustache.hash,
      },
      AppendSyntaxContext(mustache)
    );

    let value = callParts.args.isEmpty()
      ? callParts.callee
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
  BlockStatement(block: ASTv1.BlockStatement): ASTv2.InvokeBlock {
    let { program, inverse, loc } = block;

    let resolution = this.block.resolutionFor(block, BlockSyntaxContext);

    if (resolution.resolution === 'error') {
      throw new GlimmerSyntaxError(
        `You attempted to invoke a path (\`{{#${resolution.path}}}\`) but ${resolution.head} was not in scope`,
        loc
      );
    }

    let callParts = this.expr.callParts(block, resolution.resolution);

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
    return new BlockChildren(
      loc,
      body.map((b) => normalizer.normalize(b))
    ).assertBlock(child.table);
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

    let attrs = element.attributes.filter((a) => a.name[0] !== '@').map((a) => this.attr(a));
    let args = element.attributes.filter((a) => a.name[0] === '@').map((a) => this.arg(a));

    let modifiers = element.modifiers.map((m) => this.modifier(m));

    // the element's block params are in scope for the children
    let child = this.ctx.child(element.blockParams);
    let normalizer = new StatementNormalizer(child);

    let childNodes = element.children.map((s) => normalizer.normalize(s));

    let el = builders.element({
      selfClosing,
      attrs,
      args,
      modifiers,
      comments: comments.map((c) => new StatementNormalizer(this.ctx).MustacheCommentStatement(c)),
    });

    let children = new ElementChildren(el, loc, childNodes);

    if (path === 'ElementHead') {
      if (tag[0] === ':') {
        return children.assertNamedBlock(tag.slice(1), child.table);
      } else {
        return children.assertElement(tag, element.blockParams.length > 0);
      }
    }

    if (element.selfClosing) {
      return el.selfClosingComponent(path, loc);
    } else {
      let blocks = children.assertComponent(tag, child.table, element.blockParams.length > 0);
      return el.componentWithNamedBlocks(path, blocks, loc);
    }
  }

  private modifier(m: ASTv1.ElementModifierStatement): ASTv2.ElementModifier {
    let resolution = this.ctx.resolutionFor(m, ModifierSyntaxContext);

    if (resolution.resolution === 'error') {
      throw new GlimmerSyntaxError(
        `You attempted to invoke a path (\`{{#${resolution.path}}}\`) but ${resolution.head} was not in scope`,
        m.loc
      );
    }

    let callParts = this.expr.callParts(m, resolution.resolution);
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
  private mustacheAttr(mustache: ASTv1.MustacheStatement): ASTv2.Expression {
    // Normalize the call parts in AttrValueSyntaxContext
    let sexp = builders.sexp(
      this.expr.callParts(mustache, AttrValueSyntaxContext(mustache)),
      mustache.loc
    );

    // If there are no params or hash, just return the function part as its own expression
    if (sexp.args.isEmpty()) {
      return sexp.callee;
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
  ): { expr: ASTv2.Expression; trusting: boolean } {
    switch (part.type) {
      case 'MustacheStatement':
        return { expr: this.mustacheAttr(part), trusting: !part.escaped };
      case 'TextNode':
        return { expr: builders.literal(part.chars, part.loc), trusting: true };
    }
  }

  private attrValue(
    part: ASTv1.MustacheStatement | ASTv1.TextNode | ASTv1.ConcatStatement
  ): { expr: ASTv2.Expression; trusting: boolean } {
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

  private attr(m: ASTv1.AttrNode): ASTv2.HtmlAttr {
    assert(m.name[0] !== '@', 'An attr name must not start with `@`');

    let value = this.attrValue(m.value);
    return builders.attr(
      { name: builders.slice(m.name, SYNTHETIC), value: value.expr, trusting: value.trusting },
      m.loc
    );
  }

  private arg(m: ASTv1.AttrNode): ASTv2.Arg {
    assert(m.name[0] === '@', 'An arg name must start with `@`');

    let value = this.attrValue(m.value);
    return builders.arg(
      { name: builders.slice(m.name, SYNTHETIC), value: value.expr, trusting: value.trusting },
      m.loc
    );
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
    loc: SourceLocation
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

      let resolution = this.ctx.resolutionFor(path, ComponentSyntaxContext);

      if (resolution.resolution === 'error') {
        throw new GlimmerSyntaxError(
          `You attempted to invoke a path (\`<${resolution.path}>\`) but ${resolution.head} was not in scope`,
          loc
        );
      }

      return new ExpressionNormalizer(this.ctx).normalize(path, resolution.resolution);
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

class Children {
  readonly namedBlocks: ASTv2.NamedBlock[];
  readonly hasSemanticContent: boolean;
  readonly nonBlockChildren: ASTv2.ContentNode[];

  constructor(
    readonly loc: SourceLocation,
    readonly children: (ASTv2.ContentNode | ASTv2.NamedBlock)[]
  ) {
    this.namedBlocks = children.filter((c): c is ASTv2.NamedBlock => c.type === 'NamedBlock');
    this.hasSemanticContent = !!children.find((c): c is ASTv2.ContentNode => {
      switch (c.type) {
        case 'NamedBlock':
        case 'GlimmerComment':
        case 'HtmlComment':
          return false;
        case 'HtmlText':
          return !/^\s*$/.exec(c.chars);
        default:
          return true;
      }
    });
    this.nonBlockChildren = children.filter((c): c is ASTv2.ContentNode => c.type !== 'NamedBlock');
  }
}

class TemplateChildren extends Children {
  assertTemplate(table: ProgramSymbolTable): ASTv2.Template {
    if (isPresent(this.namedBlocks)) {
      throw new GlimmerSyntaxError(
        `Unexpected named block at the top-level of a template`,
        this.loc
      );
    }

    return builders.template(table, this.nonBlockChildren, this.loc);
  }
}

class BlockChildren extends Children {
  assertBlock(table: BlockSymbolTable): ASTv2.Block {
    if (isPresent(this.namedBlocks)) {
      throw new GlimmerSyntaxError(`Unexpected named block nested in a normal block`, this.loc);
    }

    return builders.block(table, this.nonBlockChildren);
  }
}

class ElementChildren extends Children {
  constructor(
    private el: BuildElement,
    loc: SourceLocation,
    children: (ASTv2.ContentNode | ASTv2.NamedBlock)[]
  ) {
    super(loc, children);
  }

  assertNamedBlock(name: string, table: BlockSymbolTable): ASTv2.NamedBlock {
    if (this.el.base.selfClosing) {
      throw new GlimmerSyntaxError(
        `<:${name}> is not a valid named block: named blocks cannot be self-closing`,
        this.loc
      );
    }

    if (isPresent(this.namedBlocks)) {
      throw new GlimmerSyntaxError(
        `Unexpected named block inside <:${name}> named block: named blocks cannot contain nested named blocks`,
        this.loc
      );
    }

    if (!isLowerCase(name)) {
      throw new GlimmerSyntaxError(
        `<:${name}> is not a valid named block: \`${name}\` is uppercase, and named blocks must be lowercase`,
        this.loc
      );
    }

    return builders.namedBlock(builders.slice(name), builders.block(table, this.nonBlockChildren));
  }

  assertElement(name: string, hasBlockParams: boolean): ASTv2.SimpleElement {
    if (hasBlockParams) {
      throw new GlimmerSyntaxError(
        `Unexpected block params in <${name}>: simple elements cannot have block params`,
        this.loc
      );
    }

    if (isPresent(this.namedBlocks)) {
      let names = this.namedBlocks.map((b) => b.name);

      if (names.length === 1) {
        throw new GlimmerSyntaxError(
          `Syntax Error: Unexpected named block <:foo> inside <${name}> HTML element`,
          this.loc
        );
      } else {
        let printedNames = names.map((n) => `<:${n.chars}>`).join(', ');
        throw new GlimmerSyntaxError(
          `Syntax Error: Unexpected named blocks inside <${name}> HTML element (${printedNames})`,
          this.loc
        );
      }
    }

    return this.el.simple(name, this.nonBlockChildren);
  }

  assertComponent(
    name: string,
    table: BlockSymbolTable,
    hasBlockParams: boolean
  ): PresentArray<ASTv2.NamedBlock> {
    if (isPresent(this.namedBlocks) && this.hasSemanticContent) {
      throw new GlimmerSyntaxError(
        `Unexpected content inside <${name}> component invocation: when using named blocks, the tag cannot contain other content`,
        this.loc
      );
    }

    if (isPresent(this.namedBlocks)) {
      if (hasBlockParams) {
        throw new GlimmerSyntaxError(
          `Unexpected block params list on <${name}> component invocation: when passing named blocks, the invocation tag cannot take block params`,
          this.loc
        );
      }
      return this.namedBlocks;
    } else {
      return [
        builders.namedBlock(
          builders.slice('default'),
          builders.block(table, this.nonBlockChildren, this.loc)
        ),
      ];
    }
  }
}

function isUpperCase(tag: string): boolean {
  return tag[0] === tag[0].toUpperCase() && tag[0] !== tag[0].toLowerCase();
}

function isLowerCase(tag: string): boolean {
  return tag[0] === tag[0].toLowerCase() && tag[0] !== tag[0].toUpperCase();
}

function printPath(node: ASTv1.PathExpression | ASTv1.CallNode): string {
  if (node.type !== 'PathExpression' && node.path.type === 'PathExpression') {
    return printPath(node.path);
  } else {
    return new Printer({ entityEncoding: 'raw' }).print(node);
  }
}

function printHead(node: ASTv1.PathExpression | ASTv1.CallNode): string {
  if (node.type === 'PathExpression') {
    switch (node.head.type) {
      case 'AtHead':
      case 'VarHead':
        return node.head.name;
      case 'ThisHead':
        return 'this';
    }
  } else if (node.path.type === 'PathExpression') {
    return printHead(node.path);
  } else {
    return new Printer({ entityEncoding: 'raw' }).print(node);
  }
}
