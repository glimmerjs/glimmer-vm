import type { Optional, PresentArray } from '@glimmer/interfaces';
import type { IsEqual } from 'type-fest';
import {
  asPresentArray,
  exhausted,
  isPresentArray,
  localAssert,
  unreachable,
} from '@glimmer/debug-util';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';

import type {
  PrecompileOptions,
  PrecompileOptionsWithLexicalScope,
} from '../parser/tokenizer-event-handlers';
import type { SourceLocation } from '../source/location';
import type { Source } from '../source/source';
import type { SourceOffset, SourceSpan } from '../source/span';
import type { BlockSymbolTable, ProgramSymbolTable } from '../symbol-table';
import type * as ASTv1 from '../v1/api';
import type { BuildElement } from './builders';
import type { Resolution } from './loose-resolution';

import Printer from '../generation/printer';
import { preprocess } from '../parser/tokenizer-event-handlers';
import { SourceSlice } from '../source/slice';
import { SpanList } from '../source/span-list';
import { SymbolTable } from '../symbol-table';
import { generateSyntaxError } from '../syntax-error';
import { isLowerCase, isUpperCase } from '../utils';
import b from '../v1/parser-builders';
import { getErrorsFromResults, isResultsError } from '../v1/utils';
import * as ASTv2 from './api';
import { Builder } from './builders';

type ResolveCandidate = ASTv1.PathExpression & { head: ASTv1.VarHead; tail: [] };

export function normalize(
  source: Source,
  options: PrecompileOptionsWithLexicalScope = { lexicalScope: () => false }
): [ast: ASTv2.Template, locals: string[]] {
  let ast = preprocess(source, options);

  let normalizeOptions = {
    strictMode: false,
    ...options,
    locals: Array.isArray(ast.blockParams) ? ast.blockParams : [],
    keywords: options.keywords ?? [],
  };

  let top = SymbolTable.top(normalizeOptions.locals, normalizeOptions.keywords, {
    customizeComponentName: options.customizeComponentName ?? ((name) => name),
    lexicalScope: options.lexicalScope,
  });
  let block = new BlockContext(source, normalizeOptions, top);
  let normalizer = new StatementNormalizer(block);

  let astV2 = new TemplateChildren(
    block.loc(ast.loc),
    ast.body.map((b) => normalizer.normalize(b)),
    block
  ).assertTemplate(top, ast.error);

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

  /**
   * Returns true if the head of the specified path expression is a variable reference,
   * and that variable is not in scope.
   */
  hasInvalidVarReference(
    node: ASTv1.PathExpression
  ): node is ASTv1.PathExpression & { head: ASTv1.VarHead } {
    return node.head.type === 'VarHead' && !this.hasBinding(node.head.name);
  }

  /**
   * Returns true if:
   *
   * 1. the head of the specified path expression is an invalid variable reference
   * 2. the template is not in strict mode
   * 3. the path expression has no tail
   */
  invalidPathIsResolveCandidate(node: ASTv1.PathExpression & { head: ASTv1.VarHead }): boolean {
    if (LOCAL_DEBUG && this.hasBinding(node.head.name)) {
      throw new Error(
        `[BUG] Don't call isResolveCandidate unless you checked hasInvalidVarReference first and it returned false`
      );
    }

    return !this.strict && node.tail.length === 0 && this.hasInvalidVarReference(node);
  }

  /**
   * Returns true if all of the following are true:
   *
   * 1. The node is a PathExpression
   * 2. The path expression is a VarHead (a bare identifier) with no tail (i.e. `.`-separated
   *    properties)
   * 3. The VarHead's name is not in scope.
   *
   * This can result in one of three outcomes:
   *
   * 1. The variable name is eventually resolved as a keyword
   * 2. In classic mode, the variable name is resolved via the runtime resolver
   * 3. In strict mode, a syntax error
   */
  exprIsResolveCandidate(node: ASTv1.Expression): node is ResolveCandidate {
    return (
      node.type === 'PathExpression' && this.hasInvalidVarReference(node) && node.tail.length === 0
    );
  }

  getCallee<E extends ASTv1.Expression>(
    node: E,
    expr: ExpressionNormalizer
  ):
    | {
        type: 'callee';
        callee: ASTv2.KeywordExpression | IsEqual<E, ASTv1.PathExpression> extends true
          ? ASTv1.ParseResult<ASTv2.PathExpression>
          : ASTv1.ParseResult<ASTv2.DynamicCallee>;
        loc: SourceSpan;
      }
    | {
        type: 'resolved';
        callee: ASTv2.ResolvedName | ASTv2.UnresolvedBinding;
        loc: SourceSpan;
      }
    | {
        type: 'unresolved';
        callee: ASTv2.PathExpression | ASTv2.KeywordExpression;
        loc: SourceSpan;
      }
    | {
        type: 'error';
        callee: ASTv1.ErrorNode;
        loc: SourceSpan;
      } {
    if (node.type === 'Error') {
      return { type: 'error', callee: node, loc: node.loc };
    }

    if (
      node.type === 'PathExpression' &&
      node.head.type === 'VarHead' &&
      !this.hasBinding(node.head.name)
    ) {
      if (node.tail.length > 0) {
        return { type: 'unresolved', callee: expr.strictPath(node), loc: this.loc(node.loc) };
      }

      if (this.isKeyword(node.head.name)) {
        return {
          type: 'callee',
          callee: this.builder.keyword(
            node.head.name,
            this.table.getKeyword(node.head.name),
            this.loc(node.head.loc)
          ),
          loc: this.loc(node.loc),
        };
      } else {
        const symbol = this.table.allocateFree(node.head.name, false);
        const loc = this.loc(node.head.loc);
        return {
          type: 'resolved',
          // Even in strict mode, these names can be keywords, and they're converted
          // into syntax error only once keywords are processed in @glimmer/compiler.
          callee: new ASTv2.ResolvedName({ name: node.head.name, symbol, loc }),
          loc: this.loc(node.loc),
        };
      }
    } else {
      const callee = expr.normalizeExpr(node);

      localAssert(
        callee.type === 'Keyword' ||
          callee.type === 'Path' ||
          callee.type === 'Call' ||
          callee.type === 'ResolvedCall' ||
          callee.type === 'Error',
        `BUG: callee should be a dynamic value (keyword, path, or call), but was ${callee.type}`
      );

      return { type: 'callee', callee, loc: this.loc(node.loc) };
    }
  }

  handleCallee(
    node: ASTv1.ParseResult<ASTv1.PathExpression>,
    expr: ExpressionNormalizer
  ): ASTv2.ResolvedName | ASTv2.UnresolvedBinding | ASTv2.KeywordExpression | ASTv2.PathExpression;
  handleCallee(
    node: ASTv1.Expression,
    expr: ExpressionNormalizer
  ): ASTv2.ResolvedName | ASTv2.UnresolvedBinding | ASTv2.KeywordExpression | ASTv2.DynamicCallee;
  handleCallee(
    node: ASTv1.Expression,
    expr: ExpressionNormalizer
  ):
    | ASTv2.KeywordExpression
    | ASTv2.DynamicCallee
    | ASTv2.ResolvedName
    | ASTv2.UnresolvedBinding
    | ASTv2.PathExpression
    | ASTv1.ErrorNode {
    return this.getCallee(node, expr).callee;
  }

  resolveCandidateIsSyntaxError(node: ResolveCandidate) {
    return this.strict && !this.hasBinding(node.head.name) && !this.isKeyword(node.head.name);
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

  isKeyword(name: string): boolean {
    return this.strict && !this.table.hasLexical(name) && this.table.hasKeyword(name);
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

  child(blockParams: ASTv1.BlockParams): BlockContext<BlockSymbolTable> {
    return new BlockContext(this.source, this.options, this.table.child(blockParams.names));
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
   * The `normalizeDynamic` normalizes an expression that is not a candidate for namespaced
   * resolution into an ASTv2.ExpressionValueNode.
   */
  normalizeExpr(expr: ASTv1.Literal): ASTv2.LiteralExpression;
  normalizeExpr(expr: ASTv1.SubExpression): ASTv2.CallExpression;
  normalizeExpr(expr: ASTv1.MinimalPathExpression): ASTv2.PathExpression;
  normalizeExpr(expr: ASTv1.MinimalPathExpression): ASTv2.PathExpression;
  normalizeExpr(expr: ASTv1.Expression): ASTv2.ExpressionValueNode;
  normalizeExpr(expr: ASTv1.Expression | ASTv1.MinimalPathExpression): ASTv2.ExpressionValueNode {
    switch (expr.type) {
      case 'Error':
        return expr;
      case 'NullLiteral':
      case 'BooleanLiteral':
      case 'NumberLiteral':
      case 'StringLiteral':
      case 'UndefinedLiteral':
        return this.block.builder.literal(expr.value, this.block.loc(expr.loc));
      case 'PathExpression':
        return this.strictPath(expr);
      case 'SubExpression': {
        // expr.path used to incorrectly have the type ASTv1.Expression

        const result = this.block.getCallee(expr.path, this);

        const args =
          this.callArgs(expr.params, expr.hash) ?? ASTv2.EmptyCurlyArgs(result.loc.collapse('end'));

        if (result.type === 'resolved') {
          return new ASTv2.ResolvedCallExpression({
            resolved: result.callee,
            args,
            loc: this.block.loc(expr.loc),
          });
        }

        return new ASTv2.CallExpression({
          callee: result.callee,
          args,
          loc: this.block.loc(expr.loc),
        });
      }
    }
  }

  strictPath(expr: ASTv1.MinimalPathExpression): ASTv2.KeywordExpression | ASTv2.PathExpression {
    let loc = this.block.loc(expr.loc);

    if (
      expr.head.type === 'VarHead' &&
      expr.tail.length === 0 &&
      this.block.isKeyword(expr.head.name)
    ) {
      return this.block.builder.keyword(
        expr.head.name,
        this.block.table.getKeyword(expr.head.name),
        loc
      );
    }

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

    return this.block.builder.path(this.strictRef(expr.head), tail, loc);
  }

  /**
   * Normalizes ASTv1 params and hash into an ASTv2 Args. The `start` parameter is the location of
   * the end of the callee, and is used as the default location for arguments if no locations are
   * provided.
   */
  callArgs(params: ASTv1.Expression[], hash: ASTv1.Hash): Optional<ASTv2.CurlyArgs> {
    if (params.length === 0 && hash.pairs.length === 0) {
      return undefined;
    }

    const start = getStart(params[0], hash.pairs[0]);
    let paramList = params.map((p) => this.normalizeExpr(p));
    let paramLoc = SpanList.range(paramList, start.collapsed());
    let namedLoc = this.block.loc(hash.loc);
    let argsLoc = SpanList.range([paramLoc, namedLoc]);

    let positional = this.block.builder.positional(
      params.map((p) => this.normalizeExpr(p)),
      paramLoc
    );

    let named = this.block.builder.named(
      hash.pairs.map((p) => this.namedArgument(p)),
      this.block.loc(hash.loc)
    );

    return new ASTv2.BaseArgs({
      loc: argsLoc,
      positional,
      named,
    }) as ASTv2.CurlyArgs;
  }

  private namedArgument(pair: ASTv1.HashPair): ASTv2.CurlyArgument {
    let offsets = this.block.loc(pair.loc);

    let keyOffsets = offsets.sliceStartChars({ chars: pair.key.length });

    return this.block.builder.namedArgument(
      new SourceSlice({ chars: pair.key, loc: keyOffsets }),
      this.normalizeExpr(pair.value)
    );
  }

  private strictRef(
    head: ASTv1.PathHead
  ):
    | ASTv2.ThisReference
    | ASTv2.ArgReference
    | ASTv2.LocalVarReference
    | ASTv2.LexicalVarReference
    | ASTv2.UnresolvedBinding {
    let { block } = this;
    let { builder, table } = block;
    let offsets = block.loc(head.loc);

    switch (head.type) {
      case 'ThisHead':
        if (block.hasBinding('this')) {
          let [symbol, isLexical] = table.get('this');
          return block.builder.localVar('this', symbol, isLexical, offsets);
        }
        return builder.self(offsets);
      case 'AtHead': {
        let symbol = table.allocateNamed(head.name);
        return builder.at(head.name, symbol, offsets);
      }
      case 'VarHead': {
        if (block.hasBinding(head.name)) {
          let [symbol, isRoot] = table.get(head.name);

          return block.builder.localVar(head.name, symbol, isRoot, offsets);
        } else {
          return new ASTv2.UnresolvedBinding({ name: head.name, loc: offsets });
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

  normalize(node: ASTv1.Statement): ASTv2.ContentNode | ASTv2.NamedBlock | ASTv1.ErrorNode {
    switch (node.type) {
      case 'Error':
        return node;
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

      default:
        exhausted(node);
    }
  }

  MustacheCommentStatement(node: ASTv1.MustacheCommentStatement): ASTv2.GlimmerComment {
    let loc = this.block.loc(node.loc);

    // If someone cares for these cases to have the right loc, feel free to attempt:
    // {{!}} {{~!}} {{!~}} {{~!~}}
    // {{!-}} {{~!-}} {{!-~}} {{~!-~}}
    // {{!--}} {{~!--}} {{!--~}} {{~!--~}}
    // {{!---}} {{~!---}} {{!---~}} {{~!---~}}
    // {{!----}} {{~!----}} {{!----~}} {{~!----~}}
    if (node.value === '') {
      return new ASTv2.GlimmerComment({
        loc,
        text: SourceSlice.synthetic(''),
      });
    }

    let source = loc.asString();
    let span = loc;

    if (node.value.startsWith('-')) {
      localAssert(
        /^\{\{~?!---/u.test(source),
        `to start a comment's content with a '-', it must have started with {{!--`
      );
      span = span.sliceStartChars({
        skipStart: source.startsWith('{{~') ? 6 : 5,
        chars: node.value.length,
      });
    } else if (node.value.endsWith('-')) {
      localAssert(
        /--~?\}\}/u.test(source),
        `to end a comment's content with a '-', it must have ended with --}}`
      );

      const skipEnd = source.endsWith('~}}') ? 5 : 4;
      const skipStart = source.length - node.value.length - skipEnd;

      span = span.slice({
        skipStart,
        skipEnd,
      });
    } else {
      span = span.sliceStartChars({
        skipStart: source.lastIndexOf(node.value),
        chars: node.value.length,
      });
    }

    return new ASTv2.GlimmerComment({
      loc,
      text: span.toSlice(node.value),
    });
  }

  /**
   * Normalizes an ASTv1.MustacheStatement to an ASTv2.AppendStatement
   */
  MustacheStatement(
    mustache: ASTv1.MustacheStatement
  ):
    | ASTv2.AppendContent
    | ASTv2.AppendResolvedContent
    | ASTv2.AppendStaticContent
    | ASTv2.AppendInvokable
    | ASTv2.AppendResolvedInvokable {
    const { path, params, hash, trusting } = mustache;
    const loc = this.block.loc(mustache.loc);

    if (isLiteral(path)) {
      if (params.length === 0 && hash.pairs.length === 0) {
        return new ASTv2.AppendStaticContent({
          value: this.block.builder.literal(path.value, this.block.loc(path.loc)),
          loc,
        });
      } else {
        assertIllegalLiteral(path, loc);
      }
    }

    if (path.type === 'SubExpression') {
      const callee = this.expr.normalizeExpr(path);

      return new ASTv2.AppendContent({
        table: this.block.table,
        trusting,
        value: callee,
        loc,
      });
    }

    const args = this.expr.callArgs(params, hash);

    const result = this.block.getCallee(path, this.expr);

    if (result.type === 'resolved') {
      if (args) {
        return new ASTv2.AppendResolvedInvokable({
          loc,
          resolved: result.callee,
          args,
          trusting,
        });
      } else {
        return new ASTv2.AppendResolvedContent({
          loc,
          resolved: result.callee,
          trusting,
        });
      }
    }

    const callee = result.callee;

    if (args) {
      return new ASTv2.AppendInvokable({
        loc,
        callee,
        args,
        trusting,
      });
    } else {
      return new ASTv2.AppendContent({
        table: this.block.table,
        trusting,
        value: callee,
        loc,
      });
    }
  }

  /**
   * Normalizes a ASTv1.BlockStatement to an ASTv2.BlockStatement
   */
  BlockStatement(block: ASTv1.BlockStatement): ASTv2.InvokeBlock | ASTv2.InvokeResolvedBlock {
    let { program, inverse, path } = block;
    let loc = this.block.loc(block.loc);

    // block.path used to incorrectly have the type ASTv1.Expression
    if (isLiteral(block.path)) {
      assertIllegalLiteral(block.path, loc);
    }

    const callee = this.block.handleCallee(path, this.expr);

    let args =
      this.expr.callArgs(block.params, block.hash) ??
      ASTv2.EmptyCurlyArgs(callee.loc.collapse('end'));

    return this.block.builder.blockStatement(
      {
        callee,
        symbols: this.block.table,
        program: this.Block(program),
        inverse: inverse ? this.Block(inverse) : null,
        args,
      },
      loc
    );
  }

  Block({ body, loc, paramsNode }: ASTv1.Block): ASTv2.Block {
    let child = this.block.child(paramsNode);
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
    let { tag, selfClosing, comments } = element;
    let loc = this.ctx.loc(element.loc);

    let [tagHead, ...rest] = asPresentArray(tag.split('.'));

    // the head, attributes and modifiers are in the current scope
    let path = this.classifyTag(tagHead, rest, element.loc);

    let attrs = element.attributes.filter((a) => a.name[0] !== '@').map((a) => this.attr(a));
    let args = element.attributes.filter((a) => a.name[0] === '@').map((a) => this.arg(a));

    let modifiers = element.modifiers.map((m) => this.modifier(m));

    // the element's block params are in scope for the children
    let child = this.ctx.child(element.paramsNode);
    let normalizer = new StatementNormalizer(child);

    let childNodes = element.children.map((s) => normalizer.normalize(s));

    let el = this.ctx.builder.element({
      selfClosing,
      attrs,
      componentArgs: args,
      modifiers,
      comments: comments.map((c) => new StatementNormalizer(this.ctx).MustacheCommentStatement(c)),
    });

    /**
     * Errors in block params count as block params, since they reflect a user's intent to use block
     * params. The purpose of this flag is to communicate to the user that block params are not
     * _allowed_ in the context in question, and that's a better error message than "invalid block
     * params" when the block params aren't even allowed in the first place.
     */
    let children = new ElementChildren(el, loc, childNodes, element.paramsNode, this.ctx);

    const params = new BlockParamsNode(element.paramsNode);

    for (const error of params.errors) {
      children.addError(error);
    }

    if (element.errors) {
      children.addErrors(element.errors);
    }

    let offsets = this.ctx.loc(element.loc);
    let tagOffsets = offsets.sliceStartChars({ chars: tag.length, skipStart: 1 });

    if (path === 'ElementHead') {
      if (tag[0] === ':') {
        return children.assertNamedBlock(
          tagOffsets.slice({ skipStart: 1 }).toSlice(tag.slice(1)),
          tagOffsets,
          child.table
        );
      } else {
        return children.assertElement(tagOffsets.toSlice(tag));
      }
    }

    if (element.selfClosing) {
      return el.selfClosingComponent(path, loc);
    } else {
      let blocks = children.assertComponent(tag, child.table);
      return el.componentWithNamedBlocks(path, blocks, loc);
    }
  }

  private modifier(
    m: ASTv1.ElementModifierStatement
  ): ASTv2.ElementModifier | ASTv2.ResolvedElementModifier {
    const { path, params, hash } = m;

    // modifier.path used to incorrectly have the type ASTv1.Expression
    if (isLiteral(path)) {
      assertIllegalLiteral(path, m.loc);
    }

    const callee = this.ctx.handleCallee(path, this.expr);

    const args =
      this.expr.callArgs(params, hash) ?? ASTv2.EmptyCurlyArgs(callee.loc.collapse('end'));

    if (callee.type === 'ResolvedName' || callee.type === 'UnresolvedBinding') {
      return new ASTv2.ResolvedElementModifier({
        resolved: callee,
        args,
        loc: this.ctx.loc(m.loc),
      });
    } else {
      return new ASTv2.ElementModifier({
        callee,
        args,
        loc: this.ctx.loc(m.loc),
      });
    }
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
  private mustacheAttr(mustache: ASTv1.MustacheStatement): ASTv2.InterpolatePartNode {
    let { path, params, hash, loc } = mustache;

    if (isLiteral(path)) {
      if (params.length === 0 && hash.pairs.length === 0) {
        return new ASTv2.CurlyAttrValue({
          loc: mustache.loc,
          value: this.expr.normalizeExpr(path),
        });
      } else {
        assertIllegalLiteral(path, loc);
      }
    }

    if (params.length === 0 && hash.pairs.length === 0 && !this.ctx.exprIsResolveCandidate(path)) {
      return new ASTv2.CurlyAttrValue({ loc: mustache.loc, value: this.expr.normalizeExpr(path) });
    }

    const args = this.expr.callArgs(params, hash);

    const callee = this.ctx.handleCallee(path, this.expr);

    if (callee.type === 'ResolvedName' || callee.type === 'UnresolvedBinding') {
      if (args) {
        return new ASTv2.CurlyInvokeResolvedAttr({
          resolved: callee,
          args,
          loc: mustache.loc,
        });
      } else {
        return new ASTv2.CurlyResolvedAttrValue({
          resolved: callee,
          loc: mustache.loc,
        });
      }
    }

    if (args) {
      return new ASTv2.CurlyInvokeAttr({
        callee,
        args,
        loc: this.ctx.loc(mustache.loc),
      });
    } else {
      return new ASTv2.CurlyAttrValue({
        value: this.expr.normalizeExpr(path),
        loc: mustache.loc,
      });
    }
  }

  /**
   * attrPart is the narrowed down list of valid attribute values that are also
   * allowed as a concat part (you can't nest concats).
   */
  private attrPart(part: ASTv1.MustacheStatement | ASTv1.TextNode): {
    expr: ASTv2.InterpolatePartNode;
    trusting: boolean;
  } {
    switch (part.type) {
      case 'MustacheStatement':
        return { expr: this.mustacheAttr(part), trusting: part.trusting };
      case 'TextNode':
        return {
          expr: this.ctx.builder.literal(part.chars, this.ctx.loc(part.loc)),
          trusting: true,
        };
    }
  }

  private attrValue(part: ASTv1.MustacheStatement | ASTv1.TextNode | ASTv1.ConcatStatement): {
    expr: ASTv2.AttrValueNode;
    trusting: boolean;
  } {
    switch (part.type) {
      case 'ConcatStatement': {
        let parts = part.parts.map((p) => this.attrPart(p).expr);
        return {
          expr: this.ctx.builder.interpolate(parts, this.ctx.loc(part.loc)),
          trusting: false,
        };
      }
      default:
        return this.attrPart(part);
    }
  }

  private attr(m: ASTv1.AttrNode): ASTv2.HtmlOrSplatAttr {
    localAssert(m.name[0] !== '@', 'An attr name must not start with `@`');

    if (m.name === '...attributes') {
      return this.ctx.builder.splatAttr(this.ctx.table.allocateBlock('attrs'), this.ctx.loc(m.loc));
    }

    let offsets = this.ctx.loc(m.loc);
    let nameSlice = offsets.sliceStartChars({ chars: m.name.length }).toSlice(m.name);
    let value = this.attrValue(m.value);

    return this.ctx.builder.attr(
      { name: nameSlice, value: value.expr, trusting: value.trusting },
      offsets
    );
  }

  private arg(arg: ASTv1.AttrNode): ASTv2.ComponentArg {
    localAssert(arg.name[0] === '@', 'An arg name must start with `@`');

    let offsets = this.ctx.loc(arg.loc);
    let nameSlice = offsets.sliceStartChars({ chars: arg.name.length }).toSlice(arg.name);

    const argValue = arg.value;

    // Special-case: if the arg value is a simple mustache (like `@arg={{foo}}`), then we make it an
    // unconditional unresolved binding, even in resolution mode.
    //
    // See
    // https://rfcs.emberjs.com/id/0432-contextual-helpers/#:~:text=Another%20difference%20is%20how%20global%20helpers%20can%20be%20invoked%20without%20arguments
    // for more information.
    if (
      argValue.type === 'MustacheStatement' &&
      this.ctx.exprIsResolveCandidate(argValue.path) &&
      argValue.params.length === 0 &&
      argValue.hash.pairs.length === 0
    ) {
      const head = argValue.path.head;

      if (head.name !== 'has-block') {
        const binding = new ASTv2.UnresolvedBinding({
          name: head.name,
          loc: head.loc,
          notes: [
            [
              `Try:\n`,
              // @todo should we leave this suggestion, given that this-property-fallback is long
              // deprecated?
              `* ${arg.name}={{this.${head.name}}} if this was meant to be a property lookup, or`,
              `* ${arg.name}={{(${head.name})}} if this was meant to invoke the resolved helper, or`,
              `* ${arg.name}={{helper "${head.name}"}} if this was meant to pass the resolved helper by value`,
            ].join('\n'),
          ],
        });

        return this.ctx.builder.arg(
          {
            name: nameSlice,
            value: new ASTv2.CurlyResolvedAttrValue({ resolved: binding, loc: argValue.loc }),
            trusting: argValue.trusting,
          },
          offsets
        );
      }
    }

    const { expr, trusting } = this.attrValue(argValue);
    return this.ctx.builder.arg({ name: nameSlice, value: expr, trusting }, offsets);
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
  ): ASTv2.PathExpression | ASTv2.ResolvedName | 'ElementHead' {
    let uppercase = isUpperCase(variable);
    let inScope = variable[0] === '@' || variable === 'this' || this.ctx.hasBinding(variable);
    let variableLoc = loc.sliceStartChars({ skipStart: 1, chars: variable.length });

    if (this.ctx.strict && !inScope) {
      if (uppercase) {
        // this will turn into an error in `@glimmer/compiler`
        return new ASTv2.ResolvedName({
          name: variable,
          loc: variableLoc,
          symbol: this.ctx.table.allocateFree(variable, true),
        });
      }

      // In strict mode, values are always elements unless they are in scope
      return 'ElementHead';
    }

    // Since the parser handed us the HTML element name as a string, we need
    // to convert it into an ASTv1 path so it can be processed using the
    // expression normalizer.
    let isComponent = inScope || uppercase;

    let tailLength = tail.reduce((accum, part) => accum + 1 + part.length, 0);
    let pathEnd = variableLoc.getEnd().move(tailLength);
    let pathLoc = variableLoc.withEnd(pathEnd);

    if (isComponent) {
      const head = b.head({ original: variable, loc: variableLoc });

      let path = b.path({
        head,
        tail,
        loc: pathLoc,
      });

      if (
        head.type === 'ThisHead' ||
        head.type === 'AtHead' ||
        this.ctx.hasBinding(variable) ||
        tail.length !== 0
      ) {
        return this.expr.normalizeExpr(path);
      }

      return new ASTv2.ResolvedName({
        name: variable,
        symbol: this.ctx.table.allocateFree(variable, true),
        loc: variableLoc,
      });
    } else {
      this.ctx.table.allocateFree(variable, false);
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
    return new ExpressionNormalizer(this.ctx);
  }
}

type SingleChildNode = ASTv2.ContentNode | ASTv2.NamedBlock | ASTv1.ErrorNode;

class Children {
  readonly namedBlocks: ASTv2.NamedBlock[];
  readonly semanticContent: Optional<ASTv2.ContentNode>;

  constructor(
    readonly loc: SourceSpan,
    readonly children: SingleChildNode[],
    readonly block: BlockContext
  ) {
    this.namedBlocks = children.filter((c): c is ASTv2.NamedBlock => c instanceof ASTv2.NamedBlock);
    this.semanticContent = children.find((c): c is ASTv2.ContentNode => {
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
  }

  get nonBlockChildren(): ASTv2.ContentNode[] {
    return this.children.filter(
      (c): c is Exclude<SingleChildNode, ASTv2.NamedBlock> => !(c instanceof ASTv2.NamedBlock)
    );
  }

  /**
   * Add an error to the top of the list of children so that it can be turned into a syntax error in
   * the compiler.
   */
  addError(error: ASTv1.ErrorNode): void {
    this.children.unshift(error);
  }

  addErrors(attached: NonNullable<ASTv1.AttachedErrors<string>>): void {
    for (const errors of Object.values(attached)) {
      if (errors) this.children.unshift(...errors);
    }
  }
}

class TemplateChildren extends Children {
  assertTemplate(
    table: ProgramSymbolTable,
    error: Optional<{ eof?: ASTv1.ErrorNode }>
  ): ASTv2.Template {
    const children = [...this.nonBlockChildren];
    if (isPresentArray(this.namedBlocks)) {
      const [first] = this.namedBlocks;
      children.unshift(
        b.error(
          `Unexpected named block at the top-level of a template`,
          first.nameLoc.highlight('unexpected named block')
        )
      );
    }

    return this.block.builder.template(table, children, this.block.loc(this.loc), error);
  }
}

class BlockChildren extends Children {
  assertBlock(table: BlockSymbolTable): ASTv2.Block {
    const children = [...this.nonBlockChildren];
    if (isPresentArray(this.namedBlocks)) {
      const [first] = this.namedBlocks;
      children.unshift(
        b.error(
          `Unexpected named block nested in a normal block`,
          first.nameLoc.highlight('unexpected named block')
        )
      );
    }

    return this.block.builder.block(table, children, this.loc);
  }
}

class BlockParamsNode {
  #params: ASTv1.BlockParams;

  constructor(params: ASTv1.BlockParams) {
    this.#params = params;
  }

  get loc() {
    return this.#params.loc;
  }

  isPresent(): boolean {
    return !isResultsError(this.#params.names) && this.#params.names.length > 0;
  }

  get errors() {
    return getErrorsFromResults(this.#params.names);
  }
}

class ElementChildren extends Children {
  #blockParams: BlockParamsNode;

  constructor(
    private el: BuildElement,
    loc: SourceSpan,
    children: (ASTv2.ContentNode | ASTv2.NamedBlock | ASTv1.ErrorNode)[],
    blockParams: ASTv1.BlockParams,
    block: BlockContext
  ) {
    super(loc, children, block);
    this.#blockParams = new BlockParamsNode(blockParams);
  }

  assertNamedBlock(
    name: SourceSlice,
    nameLoc: SourceSpan,
    table: BlockSymbolTable
  ): ASTv2.NamedBlock {
    if (this.el.base.selfClosing) {
      this.addError(
        b.error(
          `Named blocks cannot be self-closing`,
          this.loc
            .highlight()
            .withPrimary(this.loc.getEnd().last(2).highlight('invalid self-closing tag'))
        )
      );
    }

    if (isPresentArray(this.namedBlocks)) {
      this.addError(
        b.error(
          `Unexpected named block inside <:${name.chars}> named block: named blocks cannot contain nested named blocks`,
          nameLoc.highlight('unexpected named block')
        )
      );
    }

    if (!isLowerCase(name.chars)) {
      this.addError(
        b.error(
          `Named blocks must start with a lowercase letter`,
          nameLoc.highlight(`${name.chars} begins with ${describeFirstChar(name.chars)}`)
        )
      );
    }

    const base = this.el.base;
    const invalidArgs = [...base.attrs, ...base.componentArgs, ...base.modifiers];
    const [first] = invalidArgs;

    if (first) {
      this.addError(
        b.error(
          `Named blocks cannot have ${describeComponentSyntax(first, 'plural')}`,
          first.loc.highlight(`invalid ${describeComponentSyntax(first, 'singular')}`)
        )
      );
    }

    let offsets = SpanList.range(this.nonBlockChildren, this.loc);

    return this.block.builder.namedBlock(
      name,
      this.block.builder.block(table, this.nonBlockChildren, offsets),
      this.loc
    );
  }

  assertElement(name: SourceSlice): ASTv2.SimpleElementNode {
    if (this.#blockParams.isPresent()) {
      this.addError(
        b.error(
          `Unexpected block params in <${name.chars}>: simple elements cannot have block params`,
          this.#blockParams.loc.highlight('unexpected block params')
        )
      );
    }

    if (isPresentArray(this.namedBlocks)) {
      const [first] = this.namedBlocks;
      let names = this.namedBlocks.map((b) => b.name);

      if (names.length === 1) {
        this.addError(
          b.error(
            `Unexpected named block <:foo> inside <${name.chars}> HTML element`,
            first.name.loc
              .withStart(first.name.loc.getStart().move(-1))
              .highlight('unexpected named block')
          )
        );
      } else {
        let printedNames = names.map((n) => `<:${n.chars}>`).join(', ');
        this.addError(
          b.error(
            `Unexpected named blocks inside <${name.chars}> HTML element (${printedNames})`,
            this.loc
          )
        );
      }
    }

    return this.el.simple(name, this.nonBlockChildren, this.loc);
  }

  assertComponent(
    nameNode: string | ASTv2.UnresolvedBinding,
    table: BlockSymbolTable
  ): PresentArray<ASTv2.NamedBlock | ASTv1.ErrorNode> {
    const name = typeof nameNode === 'string' ? nameNode : nameNode.name;

    if (isPresentArray(this.namedBlocks)) {
      const namedBlocks: PresentArray<ASTv2.NamedBlock | ASTv1.ErrorNode> = [...this.namedBlocks];
      if (this.semanticContent) {
        namedBlocks.unshift(
          b.error(
            `Unexpected content inside <${name}> component invocation: when using named blocks, the tag cannot contain other content`,
            this.semanticContent.loc.highlight('unexpected content')
          )
        );
      }

      if (this.#blockParams.isPresent()) {
        namedBlocks.unshift(
          b.error(
            `Unexpected block params list on <${name}> component invocation: when passing named blocks, the invocation tag cannot take block params`,
            this.#blockParams.loc.highlight('unexpected block params')
          )
        );
      }

      let seenNames = new Set<string>();

      for (let block of this.namedBlocks) {
        let name = block.name.chars;

        if (seenNames.has(name)) {
          namedBlocks.unshift(
            b.error(
              `Component had two named blocks with the same name, \`<:${name}>\`. Only one block with a given name may be passed`,
              block.nameLoc.highlight('duplicate named block')
            )
          );
        }

        if (
          (name === 'inverse' && seenNames.has('else')) ||
          (name === 'else' && seenNames.has('inverse'))
        ) {
          namedBlocks.unshift(
            b.error(
              `Component has both <:else> and <:inverse> block. <:inverse> is an alias for <:else>`,
              block.nameLoc.highlight(
                `${name} is the same as ${name === 'else' ? 'inverse' : 'else'}`
              )
            )
          );
        }

        seenNames.add(name);
      }

      return namedBlocks;
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

function describeFirstChar(name: string): string {
  if (/^[A-Z]/u.test(name)) {
    return `a capital letter`;
  } else if (/^\d/u.test(name)) {
    return `a number`;
  } else {
    return `${name[0]}`;
  }
}

function describeComponentSyntax(
  syntax: ASTv2.AttrNode | ASTv2.SomeElementModifier,
  type: 'singular' | 'plural'
): string {
  switch (syntax.type) {
    case 'HtmlAttr':
      return type === 'singular' ? `attribute` : `attributes`;
    case 'SplatAttr':
      return type === 'singular' ? `...attributes` : `...attributes`;
    case 'ComponentArg':
      return type === 'singular' ? `argument` : `arguments`;
    case 'ElementModifier':
    case 'ResolvedElementModifier':
      return type === 'singular' ? `modifier` : `modifiers`;
    default:
      exhausted(syntax);
  }
}

function isLiteral(node: ASTv1.Expression): node is ASTv1.Literal {
  switch (node.type) {
    case 'StringLiteral':
    case 'BooleanLiteral':
    case 'NumberLiteral':
    case 'UndefinedLiteral':
    case 'NullLiteral':
      return true;
    default:
      return false;
  }
}

function assertIllegalLiteral(node: ASTv1.Literal, loc: SourceSpan): never {
  let value = node.type === 'StringLiteral' ? JSON.stringify(node.value) : String(node.value);
  throw generateSyntaxError(`Unexpected literal \`${value}\``, loc);
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
    return node.head.original;
  } else if (node.path.type === 'PathExpression') {
    return printHead(node.path);
  } else {
    return new Printer({ entityEncoding: 'raw' }).print(node);
  }
}

function getStart(...choices: (ASTv1.BaseNode | undefined)[]): SourceOffset {
  for (const choice of choices) {
    if (choice !== undefined) {
      return choice.loc.getStart();
    }
  }

  unreachable(
    '[BUG] you should only call getStart if you know for sure that at least one of the parameters is not undefined'
  );
}
