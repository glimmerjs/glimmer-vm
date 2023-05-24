import type { PresentArray } from '@glimmer/interfaces';
import { asPresentArray, assert, assign, isPresentArray } from '@glimmer/util';

import Printer from '../generation/printer';
import {
  type PrecompileOptions,
  type PrecompileOptionsWithLexicalScope,
  preprocess,
} from '../parser/tokenizer-event-handlers';
import type { SourceLocation } from '../source/location';
import { SourceSlice } from '../source/slice';
import type { Source } from '../source/source';
import type { SourceSpan } from '../source/span';
import { SpanList } from '../source/span-list';
import { type BlockSymbolTable, type ProgramSymbolTable, SymbolTable } from '../symbol-table';
import { generateSyntaxError } from '../syntax-error';
import { isLowerCase, isUpperCase } from '../utils';
import type * as ASTv1 from '../v1/api';
import b from '../v1/parser-builders';
import * as ASTv2 from './api';
import { type BuildElement, Builder, type CallParts } from './builders';
import {
  AppendSyntaxContext,
  AttrValueSyntaxContext as AttributeValueSyntaxContext,
  BlockSyntaxContext,
  ComponentSyntaxContext,
  ModifierSyntaxContext,
  type Resolution,
  SexpSyntaxContext,
} from './loose-resolution';

export function normalize(
  source: Source,
  options?: PrecompileOptionsWithLexicalScope
): [ast: ASTv2.Template, locals: string[]] {
  let ast = preprocess(source, options);

  let normalizeOptions = {
    strictMode: false,
    locals: [],
    ...options,
  };

  let top = SymbolTable.top(
    normalizeOptions.locals,

    {
      customizeComponentName: options?.customizeComponentName ?? ((name) => name),
      lexicalScope: options?.lexicalScope ?? (() => false),
    }
  );
  let block = new BlockContext(source, normalizeOptions, top);
  let normalizer = new StatementNormalizer(block);

  let astV2 = new TemplateChildren(
    block.span(ast.loc),
    ast.body.map((b) => normalizer.normalize(b)),
    block
  ).assertTemplate(top);

  let locals = top.getUsedTemplateLocals();

  return [astV2, locals];
}

/**
 * A `BlockContext` represents the block that a particular AST node is contained inside of.
 *
 * `BlockContext` is aware of template-wide options (such as strict mode), as well as the bindings
 * that are in-scope within that block.
 *
 * Concretely, it has the `PrecompileOptions` and current `SymbolTable`, and provides
 * facilities for working with those options.
 *
 * `BlockContext` is stateless.
 */
export class BlockContext<Table extends SymbolTable = SymbolTable> {
  readonly builder: Builder;

  constructor(
    readonly source: Source,
    private readonly options: PrecompileOptions,
    readonly table: Table
  ) {
    this.builder = new Builder();
  }

  /**
   * Requires all variable resolution to be lexically scoped. In strict resolution mode, no AST node
   * that assumes runtime resolution will be created.
   */
  get strictResolution(): boolean {
    let strictMode = this.options.strictMode;
    if (strictMode && typeof strictMode === 'object') {
      return strictMode.variables ?? false;
    }

    return strictMode ?? false;
  }

  /**
   * Assumes that all attributes are actually attributes and not properties.
   *
   * In loose attributes mode, attributes are converted into modifiers that use the classic behavior.
   */
  get strictAttributes(): boolean {
    let strictMode = this.options.strictMode;
    if (strictMode && typeof strictMode === 'object') {
      return strictMode.attributes ?? false;
    }

    return false;
  }

  get el(): ElementNormalizer {
    return new ElementNormalizer(this);
  }

  get expr(): ExpressionNormalizer {
    return new ExpressionNormalizer(this);
  }

  get stmt(): StatementNormalizer {
    return new StatementNormalizer(this);
  }

  span(loc: SourceLocation): SourceSpan {
    return this.source.spanFor(loc);
  }

  resolutionFor<N extends ASTv1.CallNode | ASTv1.PathExpression>(
    node: N,
    resolution: Resolution<N>
  ): { result: ASTv2.FreeVarResolution } | { result: 'error'; path: string; head: string } {
    if (this.strictResolution) {
      return { result: ASTv2.STRICT_RESOLUTION };
    }

    if (this.isFreeVar(node)) {
      let r = resolution(node);

      if (r === null) {
        return {
          result: 'error',
          path: printPath(node),
          head: printHead(node),
        };
      }

      return { result: r };
    } else {
      return { result: ASTv2.STRICT_RESOLUTION };
    }
  }

  isLexicalVar(variable: string): boolean {
    return this.table.hasLexical(variable);
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
    return this.table.has(name) || this.table.hasLexical(name);
  }

  child(blockParameters: string[]): BlockContext<BlockSymbolTable> {
    return new BlockContext(this.source, this.options, this.table.child(blockParameters));
  }

  customizeComponentName(input: string): string {
    return this.options.customizeComponentName ? this.options.customizeComponentName(input) : input;
  }
}

class Normalizer<Table extends SymbolTable = SymbolTable> {
  readonly #block: BlockContext<Table>;

  constructor(block: BlockContext<Table>) {
    this.#block = block;
  }

  get strict() {
    return {
      attributes: this.#block.strictAttributes,
      resolution: this.#block.strictResolution,
    };
  }

  get table() {
    return this.#block.table;
  }

  get b() {
    return this.#block.builder;
  }

  get el(): ElementNormalizer {
    return this.#block.el;
  }

  get expr(): ExpressionNormalizer {
    return this.#block.expr;
  }

  get stmt(): StatementNormalizer {
    return this.#block.stmt;
  }

  child<T>(
    blockParams: string[],
    body: ASTv1.Statement[],
    build: (statements: ASTv2.TopLevelNode[], block: BlockContext<BlockSymbolTable>) => T
  ): T {
    let child = this.#block.child(blockParams);
    let normalizer = new StatementNormalizer(child);

    let statements = body.map((s) => normalizer.normalize(s));

    return build(statements, child);

    // let child = this.child(blockParams);
    // let normalizer = new StatementNormalizer(child);
    // return new BlockChildren(
    //   this.loc(loc),
    //   body.map((b) => normalizer.normalize(b)),
    //   this.block
    // ).assertBlock(child.table);

    // let child = this.context.child(element.blockParams);
    // let normalizer = new StatementNormalizer(child);

    // let childNodes = element.children.map((s) => normalizer.normalize(s));
  }

  resolutionFor<N extends ASTv1.CallNode | ASTv1.PathExpression>(
    node: N,
    resolution: Resolution<N>
  ): { result: ASTv2.FreeVarResolution } | { result: 'error'; path: string; head: string } {
    return this.#block.resolutionFor(node, resolution);
  }

  loc(node: SourceLocation | ASTv1.Node) {
    return 'type' in node ? this.#block.span(node.loc) : this.#block.span(node);
  }
}

/**
 * An `ExpressionNormalizer` normalizes expressions within a block.
 *
 * `ExpressionNormalizer` is stateless.
 */
class ExpressionNormalizer extends Normalizer {
  /**
   * The `normalize` method takes an arbitrary expression and its original syntax context and
   * normalizes it to an ASTv2 expression.
   *
   * @see {SyntaxContext}
   */
  normalize(expr: ASTv1.Literal, resolution: ASTv2.FreeVarResolution): ASTv2.LiteralExpression;
  normalize(
    expr: ASTv1.MinimalPathExpression,
    resolution: ASTv2.FreeVarResolution
  ): ASTv2.PathExpression;
  normalize(expr: ASTv1.SubExpression, resolution: ASTv2.FreeVarResolution): ASTv2.CallExpression;
  normalize(expr: ASTv1.Expression, resolution: ASTv2.FreeVarResolution): ASTv2.ExpressionNode;
  normalize(
    expr: ASTv1.Expression | ASTv1.MinimalPathExpression,
    resolution: ASTv2.FreeVarResolution
  ): ASTv2.ExpressionNode {
    switch (expr.type) {
      case 'NullLiteral':
      case 'BooleanLiteral':
      case 'NumberLiteral':
      case 'StringLiteral':
      case 'UndefinedLiteral':
        return this.b.literal(expr.value, this.loc(expr.loc));
      case 'PathExpression':
        return this.path(expr, resolution);
      case 'SubExpression': {
        let resolution = this.resolutionFor(expr, SexpSyntaxContext);

        if (resolution.result === 'error') {
          throw generateSyntaxError(
            `You attempted to invoke a path (\`${resolution.path}\`) but ${resolution.head} was not in scope`,
            expr.loc
          );
        }

        return this.b.sexp(this.callParts(expr, resolution.result), this.loc(expr.loc));
      }
    }
  }

  private path(
    expr: ASTv1.MinimalPathExpression,
    resolution: ASTv2.FreeVarResolution
  ): ASTv2.PathExpression {
    let headOffsets = this.loc(expr.head.loc);

    let tail = [];

    // start with the head
    let offset = headOffsets;

    for (let part of expr.tail) {
      offset = offset.sliceStartChars({ chars: part.length, skipStart: 1 });
      tail.push(
        new SourceSlice({
          loc: offset,
          chars: part,
        })
      );
    }

    return this.b.path(this.ref(expr.head, resolution), tail, this.loc(expr.loc));
  }

  /**
   * The `callParts` method takes ASTv1.CallParts as well as a syntax context and normalizes
   * it to an ASTv2 CallParts.
   */
  callParts(parts: ASTv1.CallParts, context: ASTv2.FreeVarResolution): CallParts {
    let { path, params, hash } = parts;

    let callee = this.normalize(path, context);
    let parameterList = params.map((p) => this.normalize(p, ASTv2.ARGUMENT_RESOLUTION));
    let parameterLoc = SpanList.range(parameterList, callee.loc.collapse('end'));
    let namedLoc = this.loc(hash.loc);
    let argsLoc = SpanList.range([parameterLoc, namedLoc]);

    let positional = this.b.positional(
      params.map((p) => this.normalize(p, ASTv2.ARGUMENT_RESOLUTION)),
      parameterLoc
    );

    let named = this.b.named(
      hash.pairs.map((p) => this.namedArgument(p)),
      this.loc(hash.loc)
    );

    return {
      callee,
      args: this.b.args(positional, named, argsLoc),
    };
  }

  private namedArgument(pair: ASTv1.HashPair): ASTv2.NamedArgument {
    let offsets = this.loc(pair.loc);

    let keyOffsets = offsets.sliceStartChars({ chars: pair.key.length });

    return this.b.namedArgument(
      new SourceSlice({ chars: pair.key, loc: keyOffsets }),
      this.normalize(pair.value, ASTv2.ARGUMENT_RESOLUTION)
    );
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
  private ref(head: ASTv1.PathHead, resolution: ASTv2.FreeVarResolution): ASTv2.VariableReference {
    let { b, table } = this;
    let offsets = this.loc(head.loc);

    switch (head.type) {
      case 'ThisHead':
        return b.self(offsets);
      case 'AtHead': {
        let symbol = table.allocateNamed(head.name);
        return b.at(head.name, symbol, offsets);
      }
      case 'VarHead':
        if (table.hasBinding(head.name)) {
          let [symbol, isRoot] = table.get(head.name);

          return b.localVar(head.name, symbol, isRoot, offsets);
        } else {
          let context = this.strict.resolution ? ASTv2.STRICT_RESOLUTION : resolution;
          let symbol = table.allocateFree(head.name, context);

          return b.freeVar({
            name: head.name,
            context,
            symbol,
            loc: offsets,
          });
        }
    }
  }
}

/**
 * `TemplateNormalizer` normalizes top-level ASTv1 statements to ASTv2.
 */
class StatementNormalizer extends Normalizer {
  // constructor(private readonly block: BlockContext) {}

  normalize(node: ASTv1.Statement): ASTv2.TopLevelNode {
    switch (node.type) {
      case 'PartialStatement':
        throw new Error(`Handlebars partial syntax ({{> ...}}) is not allowed in Glimmer`);
      case 'BlockStatement':
        return this.BlockStatement(node);
      case 'ElementNode':
        return this.el.ElementNode(node);
      case 'MustacheStatement':
        return this.MustacheStatement(node);

      // These are the same in ASTv2
      case 'MustacheCommentStatement':
        return this.MustacheCommentStatement(node);

      case 'CommentStatement': {
        let loc = this.loc(node);
        return new ASTv2.HtmlComment({
          loc,
          text: loc.slice({ skipStart: 4, skipEnd: 3 }).toSlice(node.value),
        });
      }

      case 'TextNode':
        return new ASTv2.HtmlText({
          loc: this.loc(node),
          chars: node.chars,
        });
    }
  }

  MustacheCommentStatement(node: ASTv1.MustacheCommentStatement): ASTv2.GlimmerComment {
    let loc = this.loc(node);
    let textLoc: SourceSpan;

    textLoc =
      loc.asString().slice(0, 5) === '{{!--'
        ? loc.slice({ skipStart: 5, skipEnd: 4 })
        : loc.slice({ skipStart: 3, skipEnd: 2 });

    return new ASTv2.GlimmerComment({
      loc,
      text: textLoc.toSlice(node.value),
    });
  }

  /**
   * Normalizes an ASTv1.MustacheStatement to an ASTv2.AppendStatement
   */
  MustacheStatement(mustache: ASTv1.MustacheStatement): ASTv2.AppendContent {
    let { trusting } = mustache;
    let loc = this.loc(mustache);

    // Normalize the call parts in AppendSyntaxContext
    let callParts = this.expr.callParts(
      {
        path: mustache.path,
        params: mustache.params,
        hash: mustache.hash,
      },
      AppendSyntaxContext(mustache)
    );

    let value = callParts.args.isEmpty() ? callParts.callee : this.b.sexp(callParts, loc);

    return this.b.append(
      {
        table: this.table,
        trusting,
        value,
      },
      loc
    );
  }

  /**
   * Normalizes a ASTv1.BlockStatement to an ASTv2.BlockStatement
   */
  BlockStatement(block: ASTv1.BlockStatement): ASTv2.InvokeBlock {
    let { program, inverse } = block;
    let loc = this.loc(block);

    let resolution = this.resolutionFor(block, BlockSyntaxContext);

    if (resolution.result === 'error') {
      throw generateSyntaxError(
        `You attempted to invoke a path (\`{{#${resolution.path}}}\`) but ${resolution.head} was not in scope`,
        loc
      );
    }

    let callParts = this.expr.callParts(block, resolution.result);

    return this.b.blockStatement(
      assign(
        {
          symbols: this.table,
          program: this.Block(program),
          inverse: inverse ? this.Block(inverse) : null,
        },
        callParts
      ),
      loc
    );
  }

  Block({ body, loc, blockParams }: ASTv1.Block): ASTv2.Block {
    return this.child(blockParams, body, (children, block) =>
      new BlockChildren(this.loc(loc), children, block).intoBlock()
    );
    // let child = this.child(blockParams);
    // let normalizer = new StatementNormalizer(child);
    // return new BlockChildren(
    //   this.loc(loc),
    //   body.map((b) => normalizer.normalize(b)),
    //   this.block
    // ).assertBlock(child.table);
  }
}

class ElementNormalizer extends Normalizer {
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
  ElementNode(original: ASTv1.ElementNode): ASTv2.ElementNode {
    let { tag, selfClosing, comments } = original;
    let span = this.loc(original);

    let [tagHead, ...rest] = asPresentArray(tag.split('.'));

    let attributes: ASTv2.HtmlOrSplatAttr[] = [];
    let modifiers: ASTv2.ElementModifier[] = original.modifiers.map((m) => this.modifier(m));
    let args: ASTv2.ComponentArg[] = [];

    for (let attr of original.attributes) {
      if (attr.name[0] === '@') {
        args.push(this.arg(attr));
      } else {
        let normalized = this.attr(attr);

        if (normalized.type === 'ElementModifier') {
          modifiers.push(normalized);
        } else {
          attributes.push(normalized);
        }
      }
    }

    // the element's block params are in scope for the children
    return this.child(original.blockParams, original.children, (statements, childBlock) => {
      let element = this.b.element({
        selfClosing,
        attrs: attributes,
        componentArgs: args,
        modifiers,
        comments: comments.map((c) => this.stmt.MustacheCommentStatement(c)),
        span,
      });

      let children = new ElementChildren(element, statements, childBlock);
      let tagSpan = span.sliceStartChars({ chars: tag.length, skipStart: 1 });

      // the head, attributes and modifiers are in the current scope
      return children.finalize(this.classifyTag(tagHead, rest, span), tagSpan);
    });
  }

  private modifier(m: ASTv1.ElementModifierStatement): ASTv2.ElementModifier {
    let resolution = this.resolutionFor(m, ModifierSyntaxContext);

    if (resolution.result === 'error') {
      throw generateSyntaxError(
        `You attempted to invoke a path (\`{{#${resolution.path}}}\`) as a modifier, but ${resolution.head} was not in scope. Try adding \`this\` to the beginning of the path`,
        m.loc
      );
    }

    let callParts = this.expr.callParts(m, resolution.result);
    return this.b.modifier(callParts, this.loc(m));
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
  private mustacheAttr(mustache: ASTv1.MustacheStatement): ASTv2.ExpressionNode {
    // Normalize the call parts in AttrValueSyntaxContext
    let sexp = this.b.sexp(
      this.expr.callParts(mustache, AttributeValueSyntaxContext(mustache)),
      this.loc(mustache)
    );

    // If there are no params or hash, just return the function part as its own expression
    return sexp.args.isEmpty() ? sexp.callee : sexp;
  }

  /**
   * attrPart is the narrowed down list of valid attribute values that are also
   * allowed as a concat part (you can't nest concats).
   */
  private attrPart(part: ASTv1.MustacheStatement | ASTv1.TextNode): {
    expr: ASTv2.ExpressionNode;
    trusting: boolean;
  } {
    switch (part.type) {
      case 'MustacheStatement':
        return { expr: this.mustacheAttr(part), trusting: part.trusting };
      case 'TextNode':
        return {
          expr: this.b.literal(part.chars, this.loc(part)),
          trusting: true,
        };
    }
  }

  private attrValue(part: ASTv1.MustacheStatement | ASTv1.TextNode | ASTv1.ConcatStatement): {
    expr: ASTv2.ExpressionNode;
    trusting: boolean;
  } {
    switch (part.type) {
      case 'ConcatStatement': {
        let parts = part.parts.map((p) => this.attrPart(p).expr);
        return {
          expr: this.b.interpolate(parts, this.loc(part)),
          trusting: false,
        };
      }
      default:
        return this.attrPart(part);
    }
  }

  private attr(m: ASTv1.AttributeNode): ASTv2.ElementModifier | ASTv2.HtmlOrSplatAttr {
    assert(m.name[0] !== '@', 'An attr name must not start with `@`');

    if (m.name === '...attributes') {
      return this.b.splatAttr(this.table.allocateBlock('attrs'), this.loc(m.loc));
    }

    let offsets = this.loc(m);
    let nameSlice = offsets.sliceStartChars({ chars: m.name.length }).toSlice(m.name);

    let value = this.attrValue(m.value);

    return this.b.attr({ name: nameSlice, value: value.expr, trusting: value.trusting }, offsets);

    // return this.context.strictAttributes
    //   ? this.b.attr(
    //       { name: nameSlice, value: value.expr, trusting: value.trusting },
    //       offsets
    //     )
    //   : this.b.modifier(
    //       {
    //         callee: this.context.builder.keyword(
    //           'classic:attr',
    //           SourceSlice.synthetic('classic:attr').loc
    //         ),
    //       },
    //       // {
    //       //   callee: 'classic:attr',
    //       //   args: this.context.builder.args([nameSlice, value.expr]),
    //       // },
    //       offsets
    //     );
  }

  private maybeDeprecatedCall(
    argument: SourceSlice,
    part: ASTv1.MustacheStatement | ASTv1.TextNode | ASTv1.ConcatStatement
  ): { expr: ASTv2.DeprecatedCallExpression; trusting: boolean } | null {
    if (this.strict.resolution) {
      return null;
    }

    if (part.type !== 'MustacheStatement') {
      return null;
    }

    let { path } = part;

    if (path.type !== 'PathExpression') {
      return null;
    }

    if (path.head.type !== 'VarHead') {
      return null;
    }

    let { name } = path.head;

    if (name === 'has-block' || name === 'has-block-params') {
      return null;
    }

    if (this.table.hasBinding(name)) {
      return null;
    }

    if (path.tail.length > 0) {
      return null;
    }

    if (part.params.length > 0 || part.hash.pairs.length > 0) {
      return null;
    }

    let context = ASTv2.LooseModeResolution.attr();

    let callee = this.b.freeVar({
      name,
      context,
      symbol: this.table.allocateFree(name, context),
      loc: path.loc,
    });

    return {
      expr: this.b.deprecatedCall(argument, callee, part.loc),
      trusting: false,
    };
  }

  private arg(argument: ASTv1.AttributeNode): ASTv2.ComponentArg {
    assert(argument.name[0] === '@', 'An arg name must start with `@`');

    let offsets = this.loc(argument);
    let nameSlice = offsets.sliceStartChars({ chars: argument.name.length }).toSlice(argument.name);

    let value =
      this.maybeDeprecatedCall(nameSlice, argument.value) || this.attrValue(argument.value);
    return this.b.arg({ name: nameSlice, value: value.expr, trusting: value.trusting }, offsets);
  }

  /**
   * This function classifies the head of an ASTv1.Element into an ASTv2.PathHead (if the
   * element is a component) or `'ElementHead'` (if the element is a simple element).
   *
   * Rules:
   *
   * 1. If the variable is an `@arg`, return an `AtHead`
   * 2. If the variable is `this`, return a `ThisHead`
   * 3. If the variable is in the current scope:
   *   a. If the scope is the root scope, then return a Free `LocalVarHead`
   *   b. Else, return a standard `LocalVarHead`
   * 4. If the tag name is a path and the variable is not in the current scope, Syntax Error
   * 5. If the variable is uppercase return a FreeVar(ResolveAsComponentHead)
   * 6. Otherwise, return `'ElementHead'`
   */
  private classifyTag(
    variable: string,
    tail: string[],
    loc: SourceSpan
  ): ASTv2.ExpressionNode | 'ElementHead' {
    let uppercase = isUpperCase(variable);
    let inScope = variable[0] === '@' || variable === 'this' || this.table.hasBinding(variable);

    if (this.strict.resolution && !inScope) {
      if (uppercase) {
        throw generateSyntaxError(
          `Attempted to invoke a component that was not in scope in a strict mode template, \`<${variable}>\`. If you wanted to create an element with that name, convert it to lowercase - \`<${variable.toLowerCase()}>\``,
          loc
        );
      }

      // In strict mode, values are always elements unless they are in scope
      return 'ElementHead';
    }

    // Since the parser handed us the HTML element name as a string, we need
    // to convert it into an ASTv1 path so it can be processed using the
    // expression normalizer.
    let isComponent = inScope || uppercase;

    let variableLoc = loc.sliceStartChars({ skipStart: 1, chars: variable.length });

    let tailLength = tail.reduce((accum, part) => accum + 1 + part.length, 0);
    let pathEnd = variableLoc.getEnd().move(tailLength);
    let pathLoc = variableLoc.withEnd(pathEnd);

    if (isComponent) {
      let path = b.path({
        head: b.head(variable, variableLoc),
        tail,
        loc: pathLoc,
      });

      let resolution = this.table.hasLexical(variable)
        ? { result: ASTv2.STRICT_RESOLUTION }
        : this.resolutionFor(path, ComponentSyntaxContext);

      if (resolution.result === 'error') {
        throw generateSyntaxError(
          `You attempted to invoke a path (\`<${resolution.path}>\`) but ${resolution.head} was not in scope`,
          loc
        );
      }

      return this.expr.normalize(path, resolution.result);
    } else {
      this.table.allocateFree(variable, ASTv2.STRICT_RESOLUTION);
    }

    // If the tag name wasn't a valid component but contained a `.`, it's
    // a syntax error.
    if (tail.length > 0) {
      throw generateSyntaxError(
        `You used ${variable}.${tail.join('.')} as a tag name, but ${variable} is not in scope`,
        loc
      );
    }

    return 'ElementHead';
  }
}

class Children<Table extends SymbolTable> extends Normalizer<Table> {
  readonly namedBlocks: ASTv2.NamedBlock[];
  readonly hasSemanticContent: boolean;
  readonly nonBlockChildren: ASTv2.ContentNode[];

  constructor(
    readonly span: SourceSpan,
    readonly children: (ASTv2.ContentNode | ASTv2.NamedBlock)[],
    readonly block: BlockContext<Table>
  ) {
    super(block);
    this.namedBlocks = children.filter((c): c is ASTv2.NamedBlock => c instanceof ASTv2.NamedBlock);
    this.hasSemanticContent = children.some((c): c is ASTv2.ContentNode => {
      if (c instanceof ASTv2.NamedBlock) {
        return false;
      }
      switch (c.type) {
        case 'GlimmerComment':
        case 'HtmlComment':
          return false;
        case 'HtmlText':
          return !/^\s*$/u.test(c.chars);
        default:
          return true;
      }
    });
    this.nonBlockChildren = children.filter(
      (c): c is ASTv2.ContentNode => !(c instanceof ASTv2.NamedBlock)
    );
  }
}

class TemplateChildren extends Children<ProgramSymbolTable> {
  assertTemplate(table: ProgramSymbolTable): ASTv2.Template {
    if (isPresentArray(this.namedBlocks)) {
      throw generateSyntaxError(`Unexpected named block at the top-level of a template`, this.span);
    }

    return this.b.template(table, this.nonBlockChildren, this.loc(this.span));
  }
}

class BlockChildren extends Children<BlockSymbolTable> {
  intoBlock(): ASTv2.Block {
    if (isPresentArray(this.namedBlocks)) {
      throw generateSyntaxError(`Unexpected named block nested in a normal block`, this.span);
    }

    return this.b.block(this.block.table, this.nonBlockChildren, this.span);
  }
}

class ElementChildren extends Children<BlockSymbolTable> {
  constructor(
    private element: BuildElement,
    children: (ASTv2.ContentNode | ASTv2.NamedBlock)[],
    block: BlockContext<BlockSymbolTable>
  ) {
    super(element.base.span, children, block);
  }

  finalizeComponent(path: ASTv2.ExpressionNode, tagSpan: SourceSpan) {
    if (this.element.base.selfClosing) {
      return this.element.selfClosingComponent(path, this.span);
    } else {
      let blocks = this.assertComponent(tagSpan.asString(), this.block.table);
      return this.element.componentWithNamedBlocks(path, blocks, this.span);
    }
  }

  finalize(path: ASTv2.ExpressionNode | 'ElementHead', tagSpan: SourceSpan) {
    return path === 'ElementHead'
      ? this.#finalizeElement(tagSpan, this.block.table)
      : this.finalizeComponent(path, tagSpan);
  }

  #finalizeElement(
    tagSpan: SourceSpan,
    table: BlockSymbolTable
  ): ASTv2.SimpleElement | ASTv2.NamedBlock {
    return tagSpan.asString()[0] === ':'
      ? this.assertNamedBlock(tagSpan.slice({ skipStart: 1 }).toSlice(), table)
      : this.assertElement(tagSpan.toSlice(), table.hasBlockParams);
  }

  assertNamedBlock(name: SourceSlice, table: BlockSymbolTable): ASTv2.NamedBlock {
    if (this.element.base.selfClosing) {
      throw generateSyntaxError(
        `<:${name.chars}/> is not a valid named block: named blocks cannot be self-closing`,
        this.span
      );
    }

    if (isPresentArray(this.namedBlocks)) {
      throw generateSyntaxError(
        `Unexpected named block inside <:${name.chars}> named block: named blocks cannot contain nested named blocks`,
        this.span
      );
    }

    if (!isLowerCase(name.chars)) {
      throw generateSyntaxError(
        `<:${name.chars}> is not a valid named block, and named blocks must begin with a lowercase letter`,
        this.span
      );
    }

    if (
      this.element.base.attrs.length > 0 ||
      this.element.base.componentArgs.length > 0 ||
      this.element.base.modifiers.length > 0
    ) {
      throw generateSyntaxError(
        `named block <:${name.chars}> cannot have attributes, arguments, or modifiers`,
        this.span
      );
    }

    let offsets = SpanList.range(this.nonBlockChildren, this.span);

    return this.b.namedBlock(name, this.b.block(table, this.nonBlockChildren, offsets), this.span);
  }

  assertElement(name: SourceSlice, hasBlockParameters: boolean): ASTv2.SimpleElement {
    if (hasBlockParameters) {
      throw generateSyntaxError(
        `Unexpected block params in <${name}>: simple elements cannot have block params`,
        this.span
      );
    }

    if (isPresentArray(this.namedBlocks)) {
      let names = this.namedBlocks.map((b) => b.name);

      if (names.length === 1) {
        throw generateSyntaxError(
          `Unexpected named block <:foo> inside <${name.chars}> HTML element`,
          this.span
        );
      } else {
        let printedNames = names.map((n) => `<:${n.chars}>`).join(', ');
        throw generateSyntaxError(
          `Unexpected named blocks inside <${name.chars}> HTML element (${printedNames})`,
          this.span
        );
      }
    }

    return this.element.simple(name, this.nonBlockChildren, this.span);
  }

  assertComponent(name: string, table: BlockSymbolTable): PresentArray<ASTv2.NamedBlock> {
    if (isPresentArray(this.namedBlocks) && this.hasSemanticContent) {
      throw generateSyntaxError(
        `Unexpected content inside <${name}> component invocation: when using named blocks, the tag cannot contain other content`,
        this.span
      );
    }

    if (isPresentArray(this.namedBlocks)) {
      if (table.hasBlockParams) {
        throw generateSyntaxError(
          `Unexpected block params list on <${name}> component invocation: when passing named blocks, the invocation tag cannot take block params`,
          this.span
        );
      }

      let seenNames = new Set<string>();

      for (let block of this.namedBlocks) {
        let name = block.name.chars;

        if (seenNames.has(name)) {
          throw generateSyntaxError(
            `Component had two named blocks with the same name, \`<:${name}>\`. Only one block with a given name may be passed`,
            this.span
          );
        }

        if (
          (name === 'inverse' && seenNames.has('else')) ||
          (name === 'else' && seenNames.has('inverse'))
        ) {
          throw generateSyntaxError(
            `Component has both <:else> and <:inverse> block. <:inverse> is an alias for <:else>`,
            this.span
          );
        }

        seenNames.add(name);
      }

      return this.namedBlocks;
    } else {
      return [
        this.b.namedBlock(
          SourceSlice.synthetic('default'),
          this.b.block(table, this.nonBlockChildren, this.span),
          this.span
        ),
      ];
    }
  }
}

function printPath(node: ASTv1.PathExpression | ASTv1.CallNode): string {
  return node.type !== 'PathExpression' && node.path.type === 'PathExpression'
    ? printPath(node.path)
    : new Printer({ entityEncoding: 'raw' }).print(node);
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
