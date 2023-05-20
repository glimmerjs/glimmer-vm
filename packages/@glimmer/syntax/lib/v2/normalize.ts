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
  options: PrecompileOptionsWithLexicalScope = { lexicalScope: () => false }
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
      customizeComponentName: options.customizeComponentName ?? ((name) => name),
      lexicalScope: options.lexicalScope,
    }
  );
  let block = new BlockContext(source, normalizeOptions, top);
  let normalizer = new StatementNormalizer(block);

  let astV2 = new TemplateChildren(
    block.loc(ast.loc),
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

  get strict(): boolean {
    return this.options.strictMode || false;
  }

  loc(loc: SourceLocation): SourceSpan {
    return this.source.spanFor(loc);
  }

  resolutionFor<N extends ASTv1.CallNode | ASTv1.PathExpression>(
    node: N,
    resolution: Resolution<N>
  ): { result: ASTv2.FreeVarResolution } | { result: 'error'; path: string; head: string } {
    if (this.strict) {
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
        return this.block.builder.literal(expr.value, this.block.loc(expr.loc));
      case 'PathExpression':
        return this.path(expr, resolution);
      case 'SubExpression': {
        let resolution = this.block.resolutionFor(expr, SexpSyntaxContext);

        if (resolution.result === 'error') {
          throw generateSyntaxError(
            `You attempted to invoke a path (\`${resolution.path}\`) but ${resolution.head} was not in scope`,
            expr.loc
          );
        }

        return this.block.builder.sexp(
          this.callParts(expr, resolution.result),
          this.block.loc(expr.loc)
        );
      }
    }
  }

  private path(
    expr: ASTv1.MinimalPathExpression,
    resolution: ASTv2.FreeVarResolution
  ): ASTv2.PathExpression {
    let headOffsets = this.block.loc(expr.head.loc);

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

    return this.block.builder.path(this.ref(expr.head, resolution), tail, this.block.loc(expr.loc));
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
    let namedLoc = this.block.loc(hash.loc);
    let argsLoc = SpanList.range([parameterLoc, namedLoc]);

    let positional = this.block.builder.positional(
      params.map((p) => this.normalize(p, ASTv2.ARGUMENT_RESOLUTION)),
      parameterLoc
    );

    let named = this.block.builder.named(
      hash.pairs.map((p) => this.namedArgument(p)),
      this.block.loc(hash.loc)
    );

    return {
      callee,
      args: this.block.builder.args(positional, named, argsLoc),
    };
  }

  private namedArgument(pair: ASTv1.HashPair): ASTv2.NamedArgument {
    let offsets = this.block.loc(pair.loc);

    let keyOffsets = offsets.sliceStartChars({ chars: pair.key.length });

    return this.block.builder.namedArgument(
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
    let { block } = this;
    let { builder, table } = block;
    let offsets = block.loc(head.loc);

    switch (head.type) {
      case 'ThisHead':
        return builder.self(offsets);
      case 'AtHead': {
        let symbol = table.allocateNamed(head.name);
        return builder.at(head.name, symbol, offsets);
      }
      case 'VarHead':
        if (block.hasBinding(head.name)) {
          let [symbol, isRoot] = table.get(head.name);

          return block.builder.localVar(head.name, symbol, isRoot, offsets);
        } else {
          let context = block.strict ? ASTv2.STRICT_RESOLUTION : resolution;
          let symbol = block.table.allocateFree(head.name, context);

          return block.builder.freeVar({
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

      case 'CommentStatement': {
        let loc = this.block.loc(node.loc);
        return new ASTv2.HtmlComment({
          loc,
          text: loc.slice({ skipStart: 4, skipEnd: 3 }).toSlice(node.value),
        });
      }

      case 'TextNode':
        return new ASTv2.HtmlText({
          loc: this.block.loc(node.loc),
          chars: node.chars,
        });
    }
  }

  MustacheCommentStatement(node: ASTv1.MustacheCommentStatement): ASTv2.GlimmerComment {
    let loc = this.block.loc(node.loc);
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
    let { escaped } = mustache;
    let loc = this.block.loc(mustache.loc);

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
      : this.block.builder.sexp(callParts, loc);

    return this.block.builder.append(
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
    let { program, inverse } = block;
    let loc = this.block.loc(block.loc);

    let resolution = this.block.resolutionFor(block, BlockSyntaxContext);

    if (resolution.result === 'error') {
      throw generateSyntaxError(
        `You attempted to invoke a path (\`{{#${resolution.path}}}\`) but ${resolution.head} was not in scope`,
        loc
      );
    }

    let callParts = this.expr.callParts(block, resolution.result);

    return this.block.builder.blockStatement(
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
      this.block.loc(loc),
      body.map((b) => normalizer.normalize(b)),
      this.block
    ).assertBlock(child.table);
  }

  private get expr(): ExpressionNormalizer {
    return new ExpressionNormalizer(this.block);
  }
}

class ElementNormalizer {
  constructor(private readonly context: BlockContext) {}

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
    let { tag, selfClosing, comments } = element;
    let loc = this.context.loc(element.loc);

    let [tagHead, ...rest] = asPresentArray(tag.split('.'));

    // the head, attributes and modifiers are in the current scope
    let path = this.classifyTag(tagHead, rest, element.loc);

    let attributes = element.attributes.filter((a) => a.name[0] !== '@').map((a) => this.attr(a));
    let args = element.attributes.filter((a) => a.name[0] === '@').map((a) => this.arg(a));

    let modifiers = element.modifiers.map((m) => this.modifier(m));

    // the element's block params are in scope for the children
    let child = this.context.child(element.blockParams);
    let normalizer = new StatementNormalizer(child);

    let childNodes = element.children.map((s) => normalizer.normalize(s));

    let element_ = this.context.builder.element({
      selfClosing,
      attrs: attributes,
      componentArgs: args,
      modifiers,
      comments: comments.map((c) =>
        new StatementNormalizer(this.context).MustacheCommentStatement(c)
      ),
    });

    let children = new ElementChildren(element_, loc, childNodes, this.context);

    let offsets = this.context.loc(element.loc);
    let tagOffsets = offsets.sliceStartChars({ chars: tag.length, skipStart: 1 });

    if (path === 'ElementHead') {
      return tag[0] === ':'
        ? children.assertNamedBlock(
            tagOffsets.slice({ skipStart: 1 }).toSlice(tag.slice(1)),
            child.table
          )
        : children.assertElement(tagOffsets.toSlice(tag), element.blockParams.length > 0);
    }

    if (element.selfClosing) {
      return element_.selfClosingComponent(path, loc);
    } else {
      let blocks = children.assertComponent(tag, child.table, element.blockParams.length > 0);
      return element_.componentWithNamedBlocks(path, blocks, loc);
    }
  }

  private modifier(m: ASTv1.ElementModifierStatement): ASTv2.ElementModifier {
    let resolution = this.context.resolutionFor(m, ModifierSyntaxContext);

    if (resolution.result === 'error') {
      throw generateSyntaxError(
        `You attempted to invoke a path (\`{{#${resolution.path}}}\`) as a modifier, but ${resolution.head} was not in scope. Try adding \`this\` to the beginning of the path`,
        m.loc
      );
    }

    let callParts = this.expr.callParts(m, resolution.result);
    return this.context.builder.modifier(callParts, this.context.loc(m.loc));
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
    let sexp = this.context.builder.sexp(
      this.expr.callParts(mustache, AttributeValueSyntaxContext(mustache)),
      this.context.loc(mustache.loc)
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
        return { expr: this.mustacheAttr(part), trusting: !part.escaped };
      case 'TextNode':
        return {
          expr: this.context.builder.literal(part.chars, this.context.loc(part.loc)),
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
          expr: this.context.builder.interpolate(parts, this.context.loc(part.loc)),
          trusting: false,
        };
      }
      default:
        return this.attrPart(part);
    }
  }

  private attr(m: ASTv1.AttributeNode): ASTv2.HtmlOrSplatAttr {
    assert(m.name[0] !== '@', 'An attr name must not start with `@`');

    if (m.name === '...attributes') {
      return this.context.builder.splatAttr(
        this.context.table.allocateBlock('attrs'),
        this.context.loc(m.loc)
      );
    }

    let offsets = this.context.loc(m.loc);
    let nameSlice = offsets.sliceStartChars({ chars: m.name.length }).toSlice(m.name);

    let value = this.attrValue(m.value);
    return this.context.builder.attr(
      { name: nameSlice, value: value.expr, trusting: value.trusting },
      offsets
    );
  }

  private maybeDeprecatedCall(
    argument: SourceSlice,
    part: ASTv1.MustacheStatement | ASTv1.TextNode | ASTv1.ConcatStatement
  ): { expr: ASTv2.DeprecatedCallExpression; trusting: boolean } | null {
    if (this.context.strict) {
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

    if (this.context.hasBinding(name)) {
      return null;
    }

    if (path.tail.length > 0) {
      return null;
    }

    if (part.params.length > 0 || part.hash.pairs.length > 0) {
      return null;
    }

    let context = ASTv2.LooseModeResolution.attr();

    let callee = this.context.builder.freeVar({
      name,
      context,
      symbol: this.context.table.allocateFree(name, context),
      loc: path.loc,
    });

    return {
      expr: this.context.builder.deprecatedCall(argument, callee, part.loc),
      trusting: false,
    };
  }

  private arg(argument: ASTv1.AttributeNode): ASTv2.ComponentArg {
    assert(argument.name[0] === '@', 'An arg name must start with `@`');

    let offsets = this.context.loc(argument.loc);
    let nameSlice = offsets.sliceStartChars({ chars: argument.name.length }).toSlice(argument.name);

    let value =
      this.maybeDeprecatedCall(nameSlice, argument.value) || this.attrValue(argument.value);
    return this.context.builder.arg(
      { name: nameSlice, value: value.expr, trusting: value.trusting },
      offsets
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
    let inScope = variable[0] === '@' || variable === 'this' || this.context.hasBinding(variable);

    if (this.context.strict && !inScope) {
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

      let resolution = this.context.isLexicalVar(variable)
        ? { result: ASTv2.STRICT_RESOLUTION }
        : this.context.resolutionFor(path, ComponentSyntaxContext);

      if (resolution.result === 'error') {
        throw generateSyntaxError(
          `You attempted to invoke a path (\`<${resolution.path}>\`) but ${resolution.head} was not in scope`,
          loc
        );
      }

      return new ExpressionNormalizer(this.context).normalize(path, resolution.result);
    } else {
      this.context.table.allocateFree(variable, ASTv2.STRICT_RESOLUTION);
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

  private get expr(): ExpressionNormalizer {
    return new ExpressionNormalizer(this.context);
  }
}

class Children {
  readonly namedBlocks: ASTv2.NamedBlock[];
  readonly hasSemanticContent: boolean;
  readonly nonBlockChildren: ASTv2.ContentNode[];

  constructor(
    readonly loc: SourceSpan,
    readonly children: (ASTv2.ContentNode | ASTv2.NamedBlock)[],
    readonly block: BlockContext
  ) {
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

class TemplateChildren extends Children {
  assertTemplate(table: ProgramSymbolTable): ASTv2.Template {
    if (isPresentArray(this.namedBlocks)) {
      throw generateSyntaxError(`Unexpected named block at the top-level of a template`, this.loc);
    }

    return this.block.builder.template(table, this.nonBlockChildren, this.block.loc(this.loc));
  }
}

class BlockChildren extends Children {
  assertBlock(table: BlockSymbolTable): ASTv2.Block {
    if (isPresentArray(this.namedBlocks)) {
      throw generateSyntaxError(`Unexpected named block nested in a normal block`, this.loc);
    }

    return this.block.builder.block(table, this.nonBlockChildren, this.loc);
  }
}

class ElementChildren extends Children {
  constructor(
    private element: BuildElement,
    loc: SourceSpan,
    children: (ASTv2.ContentNode | ASTv2.NamedBlock)[],
    block: BlockContext
  ) {
    super(loc, children, block);
  }

  assertNamedBlock(name: SourceSlice, table: BlockSymbolTable): ASTv2.NamedBlock {
    if (this.element.base.selfClosing) {
      throw generateSyntaxError(
        `<:${name.chars}/> is not a valid named block: named blocks cannot be self-closing`,
        this.loc
      );
    }

    if (isPresentArray(this.namedBlocks)) {
      throw generateSyntaxError(
        `Unexpected named block inside <:${name.chars}> named block: named blocks cannot contain nested named blocks`,
        this.loc
      );
    }

    if (!isLowerCase(name.chars)) {
      throw generateSyntaxError(
        `<:${name.chars}> is not a valid named block, and named blocks must begin with a lowercase letter`,
        this.loc
      );
    }

    if (
      this.element.base.attrs.length > 0 ||
      this.element.base.componentArgs.length > 0 ||
      this.element.base.modifiers.length > 0
    ) {
      throw generateSyntaxError(
        `named block <:${name.chars}> cannot have attributes, arguments, or modifiers`,
        this.loc
      );
    }

    let offsets = SpanList.range(this.nonBlockChildren, this.loc);

    return this.block.builder.namedBlock(
      name,
      this.block.builder.block(table, this.nonBlockChildren, offsets),
      this.loc
    );
  }

  assertElement(name: SourceSlice, hasBlockParameters: boolean): ASTv2.SimpleElement {
    if (hasBlockParameters) {
      throw generateSyntaxError(
        `Unexpected block params in <${name}>: simple elements cannot have block params`,
        this.loc
      );
    }

    if (isPresentArray(this.namedBlocks)) {
      let names = this.namedBlocks.map((b) => b.name);

      if (names.length === 1) {
        throw generateSyntaxError(
          `Unexpected named block <:foo> inside <${name.chars}> HTML element`,
          this.loc
        );
      } else {
        let printedNames = names.map((n) => `<:${n.chars}>`).join(', ');
        throw generateSyntaxError(
          `Unexpected named blocks inside <${name.chars}> HTML element (${printedNames})`,
          this.loc
        );
      }
    }

    return this.element.simple(name, this.nonBlockChildren, this.loc);
  }

  assertComponent(
    name: string,
    table: BlockSymbolTable,
    hasBlockParameters: boolean
  ): PresentArray<ASTv2.NamedBlock> {
    if (isPresentArray(this.namedBlocks) && this.hasSemanticContent) {
      throw generateSyntaxError(
        `Unexpected content inside <${name}> component invocation: when using named blocks, the tag cannot contain other content`,
        this.loc
      );
    }

    if (isPresentArray(this.namedBlocks)) {
      if (hasBlockParameters) {
        throw generateSyntaxError(
          `Unexpected block params list on <${name}> component invocation: when passing named blocks, the invocation tag cannot take block params`,
          this.loc
        );
      }

      let seenNames = new Set<string>();

      for (let block of this.namedBlocks) {
        let name = block.name.chars;

        if (seenNames.has(name)) {
          throw generateSyntaxError(
            `Component had two named blocks with the same name, \`<:${name}>\`. Only one block with a given name may be passed`,
            this.loc
          );
        }

        if (
          (name === 'inverse' && seenNames.has('else')) ||
          (name === 'else' && seenNames.has('inverse'))
        ) {
          throw generateSyntaxError(
            `Component has both <:else> and <:inverse> block. <:inverse> is an alias for <:else>`,
            this.loc
          );
        }

        seenNames.add(name);
      }

      return this.namedBlocks;
    } else {
      return [
        this.block.builder.namedBlock(
          SourceSlice.synthetic('default'),
          this.block.builder.block(table, this.nonBlockChildren, this.loc),
          this.loc
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
