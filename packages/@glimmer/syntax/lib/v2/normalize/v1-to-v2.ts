import { asPresentArray, assert, assign } from '@glimmer/util';

import { SourceSlice } from '../../source/slice';
import type { SourceSpan } from '../../source/span';
import { SpanList } from '../../source/span-list';
import type { BlockSymbolTable } from '../../symbol-table';
import { generateSyntaxError } from '../../syntax-error';
import { isUpperCase } from '../../utils';
import type * as ASTv1 from '../../v1/api';
import b from '../../v1/parser-builders';
import * as ASTv2 from '../api';
import type { CallParts } from '../builders';
import {
  AppendSyntaxContext,
  AttrValueSyntaxContext as AttributeValueSyntaxContext,
  BlockSyntaxContext,
  ComponentSyntaxContext,
  ModifierSyntaxContext,
  SexpSyntaxContext,
} from '../loose-resolution';
import type { BlockContext } from './children';
import { BlockChildren, ElementChildren, HasBlockContext } from './children';

class Normalizer extends HasBlockContext {
  child = <T>(
    blockParams: string[],
    body: ASTv1.Statement[],
    build: (statements: ASTv2.TopLevelNode[], block: BlockContext<BlockSymbolTable>) => T
  ): T => {
    let child = this.block.child(blockParams);
    let normalizer = new StatementNormalizer(child);

    let statements = body.map((s) => normalizer.normalize(s));

    return build(statements, child);
  };

  get el(): ElementNormalizer {
    return new ElementNormalizer(this.block);
  }

  get expr(): ExpressionNormalizer {
    return new ExpressionNormalizer(this.block);
  }

  get stmt(): StatementNormalizer {
    return new StatementNormalizer(this.block);
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
  normalize(
    expr: ASTv1.Literal,
    resolution: ASTv2.FreeVarResolution,
    normalizer: Normalizer
  ): ASTv2.LiteralExpression;
  normalize(
    expr: ASTv1.MinimalPathExpression,
    resolution: ASTv2.FreeVarResolution,
    normalizer: Normalizer
  ): ASTv2.PathExpression;
  normalize(
    expr: ASTv1.SubExpression,
    resolution: ASTv2.FreeVarResolution,
    normalizer: Normalizer
  ): ASTv2.CallExpression;
  normalize(
    expr: ASTv1.Expression,
    resolution: ASTv2.FreeVarResolution,
    normalizer: Normalizer
  ): ASTv2.ExpressionNode;
  normalize(
    expr: ASTv1.Expression | ASTv1.MinimalPathExpression,
    resolution: ASTv2.FreeVarResolution,
    { b, resolutionFor, loc }: Normalizer
  ): ASTv2.ExpressionNode {
    switch (expr.type) {
      case 'NullLiteral':
      case 'BooleanLiteral':
      case 'NumberLiteral':
      case 'StringLiteral':
      case 'UndefinedLiteral':
        return b.literal(expr.value, loc(expr.loc));
      case 'PathExpression':
        return this.#path(expr, resolution);
      case 'SubExpression': {
        let resolution = resolutionFor(expr, SexpSyntaxContext);

        if (resolution.result === 'error') {
          throw generateSyntaxError(
            `You attempted to invoke a path (\`${resolution.path}\`) but ${resolution.head} was not in scope`,
            expr.loc
          );
        }

        return b.sexp(this.callParts(expr, resolution.result), loc(expr.loc));
      }
    }
  }

  #path(
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

    return this.b.path(this.#ref(expr.head, resolution), tail, this.loc(expr.loc));
  }

  /**
   * The `callParts` method takes ASTv1.CallParts as well as a syntax context and normalizes
   * it to an ASTv2 CallParts.
   */
  callParts(parts: ASTv1.CallParts, context: ASTv2.FreeVarResolution): CallParts {
    let { path, params, hash } = parts;

    let callee = this.normalize(path, context, this);
    let parameterList = params.map((p) => this.normalize(p, ASTv2.ARGUMENT_RESOLUTION, this));
    let parameterLoc = SpanList.range(parameterList, callee.loc.collapse('end'));
    let namedLoc = this.loc(hash.loc);
    let argsLoc = SpanList.range([parameterLoc, namedLoc]);

    let positional = this.b.positional(
      params.map((p) => this.normalize(p, ASTv2.ARGUMENT_RESOLUTION, this)),
      parameterLoc
    );

    let named = this.b.named(
      hash.pairs.map((p) => this.#namedArgument(p)),
      this.loc(hash.loc)
    );

    return {
      callee,
      args: this.b.args(positional, named, argsLoc),
    };
  }

  #namedArgument(pair: ASTv1.HashPair): ASTv2.NamedArgument {
    let offsets = this.loc(pair.loc);

    let keyOffsets = offsets.sliceStartChars({ chars: pair.key.length });

    return this.b.namedArgument(
      new SourceSlice({ chars: pair.key, loc: keyOffsets }),
      this.normalize(pair.value, ASTv2.ARGUMENT_RESOLUTION, this)
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
  #ref(head: ASTv1.PathHead, resolution: ASTv2.FreeVarResolution): ASTv2.VariableReference {
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
export class StatementNormalizer extends Normalizer {
  normalize(node: ASTv1.Statement): ASTv2.TopLevelNode {
    return this[node.type](node as any);
  }

  PartialStatement(_node: ASTv1.PartialStatement): never {
    throw new Error(`Handlebars partial syntax ({{> ...}}) is not allowed in Glimmer`);
  }

  ElementNode(node: ASTv1.ElementNode): ASTv2.ElementNode {
    return this.el.normalize(node);
  }

  MustacheCommentStatement(node: ASTv1.MustacheCommentStatement): ASTv2.GlimmerComment {
    let loc = this.loc(node);
    let textLoc: SourceSpan;

    textLoc =
      loc.asString().slice(0, 5) === '{{!--'
        ? loc.slice({ skipStart: 5, skipEnd: 4 })
        : loc.slice({ skipStart: 3, skipEnd: 2 });

    return ASTv2.GlimmerComment.of({
      loc,
      text: textLoc.toSlice(node.value),
    });
  }

  TextNode(text: ASTv1.TextNode): ASTv2.HtmlText {
    return ASTv2.HtmlText.of({
      loc: this.loc(text),
      chars: text.chars,
    });
  }

  CommentStatement(comment: ASTv1.CommentStatement): ASTv2.HtmlComment {
    let loc = this.loc(comment);

    return ASTv2.HtmlComment.of({
      loc,
      text: loc.slice({ skipStart: 4, skipEnd: 3 }).toSlice(comment.value),
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
  }
}

export class ElementNormalizer extends Normalizer {
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
  normalize(original: ASTv1.ElementNode): ASTv2.ElementNode {
    let { tag, selfClosing, comments } = original;
    let span = this.loc(original);

    let [tagHead, ...rest] = asPresentArray(tag.split('.'));

    let attributes: ASTv2.HtmlOrSplatAttr[] = [];
    let modifiers: ASTv2.ElementModifier[] = original.modifiers.map((m) => this.#modifier(m));
    let args: ASTv2.ComponentArg[] = [];

    for (let attr of original.attributes) {
      if (attr.name[0] === '@') {
        args.push(this.#arg(attr));
      } else {
        let normalized = this.#attr(attr);

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
      return children._finalize_(this.#classifyTag(tagHead, rest, span), tagSpan);
    });
  }

  #modifier(m: ASTv1.ElementModifierStatement): ASTv2.ElementModifier {
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
  #mustacheAttr(mustache: ASTv1.MustacheStatement): ASTv2.ExpressionNode {
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
  #attrPart(part: ASTv1.MustacheStatement | ASTv1.TextNode): {
    expr: ASTv2.ExpressionNode;
    trusting: boolean;
  } {
    switch (part.type) {
      case 'MustacheStatement':
        return { expr: this.#mustacheAttr(part), trusting: part.trusting };
      case 'TextNode':
        return {
          expr: this.b.literal(part.chars, this.loc(part)),
          trusting: true,
        };
    }
  }

  #attrValue(part: ASTv1.MustacheStatement | ASTv1.TextNode | ASTv1.ConcatStatement): {
    expr: ASTv2.ExpressionNode;
    trusting: boolean;
  } {
    switch (part.type) {
      case 'ConcatStatement': {
        let parts = part.parts.map((p) => this.#attrPart(p).expr);
        return {
          expr: this.b.interpolate(parts, this.loc(part)),
          trusting: false,
        };
      }
      default:
        return this.#attrPart(part);
    }
  }

  #attr(m: ASTv1.AttributeNode): ASTv2.ElementModifier | ASTv2.HtmlOrSplatAttr {
    assert(m.name[0] !== '@', 'An attr name must not start with `@`');

    if (m.name === '...attributes') {
      return this.b.splatAttr(this.table.allocateBlock('attrs'), this.loc(m.loc));
    }

    let offsets = this.loc(m);
    let nameSlice = offsets.sliceStartChars({ chars: m.name.length }).toSlice(m.name);

    let value = this.#attrValue(m.value);

    return this.b.attr(
      {
        name: nameSlice,
        value: value.expr,
        trusting: value.trusting,
        strict: this.strict.attributes,
      },
      offsets
    );
  }

  #maybeDeprecatedCall(
    argument: SourceSlice,
    part: ASTv1.MustacheStatement | ASTv1.TextNode | ASTv1.ConcatStatement
  ): { expr: ASTv2.DeprecatedCallExpression; trusting: boolean } | null {
    if (this.strict.resolution) {
      return null;
    }

    if (part.type !== 'MustacheStatement') return null;

    let { path } = part;

    if (path.type !== 'PathExpression' || path.head.type !== 'VarHead') return null;

    let { name } = path.head;

    if (name === 'has-block' || name === 'has-block-params') return null;

    if (this.table.hasBinding(name)) return null;

    let { params, hash } = part;
    if (path.tail.length > 0 || params.length > 0 || hash.pairs.length > 0) return null;

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

  #arg(argument: ASTv1.AttributeNode): ASTv2.ComponentArg {
    assert(argument.name[0] === '@', 'An arg name must start with `@`');

    let offsets = this.loc(argument);
    let nameSlice = offsets.sliceStartChars({ chars: argument.name.length }).toSlice(argument.name);

    let value =
      this.#maybeDeprecatedCall(nameSlice, argument.value) || this.#attrValue(argument.value);
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
  #classifyTag(
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

      return this.expr.normalize(path, resolution.result, this);
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
