import {
  AttrNode,
  Block,
  BlockStatement,
  ElementNode,
  MustacheStatement,
  Node,
  Program,
  TextNode,
  PartialStatement,
  ConcatStatement,
  MustacheCommentStatement,
  CommentStatement,
  ElementModifierStatement,
  Expression,
  PathExpression,
  SubExpression,
  Hash,
  HashPair,
  Literal,
  StringLiteral,
  BooleanLiteral,
  NumberLiteral,
  UndefinedLiteral,
  NullLiteral,
  TopLevelStatement,
  Template,
} from '../types/nodes';
import { voidMap } from '../parser/tokenizer-event-handlers';
import { escapeText, escapeAttrValue } from './util';
import { PrinterOptions } from './printer';

const NON_WHITESPACE = /\S/;

export default class HTMLPrinter {
  private buffer = '';
  private options: PrinterOptions;

  constructor(options: PrinterOptions) {
    this.options = options;
  }

  /*
    This is used by _all_ methods on this Printer class that add to `this.buffer`,
    it allows consumers of the printer to use alternate string representations for
    a given node.

    The primary use case for this are things like source -> source codemod utilities.
    For example, ember-template-recast attempts to always preserve the original string
    formatting in each AST node if no modifications are made to it.
  */
  handledByOverride(node: Node, ensureLeadingWhitespace = false): boolean {
    if (this.options.override !== undefined) {
      let result = this.options.override(node, this.options);
      if (typeof result === 'string') {
        if (ensureLeadingWhitespace && result !== '' && NON_WHITESPACE.test(result[0])) {
          result = `${this.wrapToSpan('&#160;')}${result}`;
        }

        this.buffer += result;
        return true;
      }
    }

    return false;
  }

  Node(node: Node): void {
    switch (node.type) {
      case 'MustacheStatement':
      case 'BlockStatement':
      case 'PartialStatement':
      case 'MustacheCommentStatement':
      case 'CommentStatement':
      case 'TextNode':
      case 'ElementNode':
      case 'AttrNode':
      case 'Block':
      case 'Template':
        return this.TopLevelStatement(node);
      case 'StringLiteral':
      case 'BooleanLiteral':
      case 'NumberLiteral':
      case 'UndefinedLiteral':
      case 'NullLiteral':
      case 'PathExpression':
      case 'SubExpression':
        return this.Expression(node);
      case 'Program':
        return this.Block(node);
      case 'ConcatStatement':
        // should have an AttrNode parent
        return this.ConcatStatement(node);
      case 'Hash':
        return this.Hash(node);
      case 'HashPair':
        return this.HashPair(node);
      case 'ElementModifierStatement':
        return this.ElementModifierStatement(node);
    }

    return unreachable(node, 'Node');
  }

  Expression(expression: Expression): void {
    switch (expression.type) {
      case 'StringLiteral':
      case 'BooleanLiteral':
      case 'NumberLiteral':
      case 'UndefinedLiteral':
      case 'NullLiteral':
        return this.Literal(expression);
      case 'PathExpression':
        return this.PathExpression(expression);
      case 'SubExpression':
        return this.SubExpression(expression);
    }
    return unreachable(expression, 'Expression');
  }

  Literal(literal: Literal) {
    switch (literal.type) {
      case 'StringLiteral':
        return this.StringLiteral(literal);
      case 'BooleanLiteral':
        return this.BooleanLiteral(literal);
      case 'NumberLiteral':
        return this.NumberLiteral(literal);
      case 'UndefinedLiteral':
        return this.UndefinedLiteral(literal);
      case 'NullLiteral':
        return this.NullLiteral(literal);
    }
    return unreachable(literal, 'Literal');
  }

  TopLevelStatement(statement: TopLevelStatement) {
    switch (statement.type) {
      case 'MustacheStatement':
        return this.MustacheStatement(statement);
      case 'BlockStatement':
        return this.BlockStatement(statement);
      case 'PartialStatement':
        return this.PartialStatement(statement);
      case 'MustacheCommentStatement':
        return this.MustacheCommentStatement(statement);
      case 'CommentStatement':
        return this.CommentStatement(statement);
      case 'TextNode':
        return this.TextNode(statement);
      case 'ElementNode':
        return this.ElementNode(statement);
      case 'Block':
      case 'Template':
        return this.Block(statement);
      case 'AttrNode':
        // should have element
        return this.AttrNode(statement);
    }
    unreachable(statement, 'TopLevelStatement');
  }

  Block(block: Block | Program | Template): void {
    /*
      When processing a template like:

      ```hbs
      &#123;&#123;#if whatever&#125;&#125;
        whatever
      &#123;&#123;else if somethingElse&#125;&#125;
        something else
      &#123;&#123;else&#125;&#125;
        fallback
      &#123;&#123;/if&#125;&#125;
      ```

      The AST still _effectively_ looks like:

      ```hbs
      &#123;&#123;#if whatever&#125;&#125;
        whatever
      &#123;&#123;else&#125;&#125;&#123;&#123;#if somethingElse&#125;&#125;
        something else
      &#123;&#123;else&#125;&#125;
        fallback
      &#123;&#123;/if&#125;&#125;&#123;&#123;/if&#125;&#125;
      ```

      The only way we can tell if that is the case is by checking for
      `block.chained`, but unfortunately when the actual statements are
      processed the `block.body[0]` node (which will always be a
      `BlockStatement`) has no clue that its anscestor `Block` node was
      chained.

      This "forwards" the `chained` setting so that we can check
      it later when processing the `BlockStatement`.
    */
    if (block.chained) {
      let firstChild = block.body[0] as BlockStatement;
      firstChild.chained = true;
    }

    if (this.handledByOverride(block)) {
      return;
    }

    this.TopLevelStatements(block.body);
  }

  TopLevelStatements(statements: TopLevelStatement[]) {
    statements.forEach((statement) => this.TopLevelStatement(statement));
  }

  ElementNode(el: ElementNode): void {
    if (this.handledByOverride(el)) {
      return;
    }

    this.OpenElementNode(el);
    this.TopLevelStatements(el.children);
    this.CloseElementNode(el);
  }
  classFor(key: string): string {
    const mappings = {
      '&#40;': 'parenthesis', // (
      '&#41;': 'parenthesis', // )
      '&#60;': 'tag', // <
      '&#62;': 'tag', // >
      '&#47;': 'tag', // /
      '&#61;': 'equal', // =
      '&#34;': 'comma', // "
      '&#35;': 'hash', // #
      '&#126;': 'curly', // ~
      '&#123;': 'curly', // {
      '&#124;': 'pipe', // |
      '&#125;': 'curly', // {
      path: 'path',
      boolean: 'boolean',
      number: 'number',
      undefined: 'undefined',
      null: 'null',
      string: 'string',
      'hash-key': 'hash-key',
      'text-node': 'text-node',
      'attribute-name': 'attribute-name',
      'tag-name': 'tag-name',
      as: 'control',
      else: 'control',
      '&#160;': 'non-breaking-space',
    };
    return (mappings as any)[key] || 'unknown';
  }
  wrapToSpan(text: string, key: string = text) {
    return `<span class="${this.classFor(key)}">${text}</span>`;
  }
  OpenElementNode(el: ElementNode): void {
    this.buffer += `${this.wrapToSpan('&#60;')}${this.wrapToSpan(el.tag, 'tag-name')}`;
    if (el.attributes.length) {
      el.attributes.forEach((attr) => {
        this.buffer += this.wrapToSpan('&#160;');
        this.AttrNode(attr);
      });
    }
    if (el.modifiers.length) {
      el.modifiers.forEach((mod) => {
        this.buffer += this.wrapToSpan('&#160;');
        this.ElementModifierStatement(mod);
      });
    }
    if (el.comments.length) {
      el.comments.forEach((comment) => {
        this.buffer += this.wrapToSpan('&#160;');
        this.MustacheCommentStatement(comment);
      });
    }
    if (el.blockParams.length) {
      this.BlockParams(el.blockParams);
    }
    if (el.selfClosing) {
      this.buffer += this.wrapToSpan('&#160;') + this.wrapToSpan('&#47;');
    }
    this.buffer += this.wrapToSpan('&#62;');
  }

  CloseElementNode(el: ElementNode): void {
    if (el.selfClosing || voidMap[el.tag.toLowerCase()]) {
      return;
    }
    this.buffer +=
      this.wrapToSpan('&#60;') +
      this.wrapToSpan('&#47;') +
      this.wrapToSpan(el.tag, 'tag-name') +
      this.wrapToSpan('&#62;');
  }

  AttrNode(attr: AttrNode): void {
    if (this.handledByOverride(attr)) {
      return;
    }

    let { name, value } = attr;

    this.buffer += this.wrapToSpan(name, 'attribute-name');
    if (value.type !== 'TextNode' || value.chars.length > 0) {
      this.buffer += this.wrapToSpan('&#61;');
      this.AttrNodeValue(value);
    }
  }

  AttrNodeValue(value: AttrNode['value']) {
    if (value.type === 'TextNode') {
      this.buffer += this.wrapToSpan('&#34;');
      this.TextNode(value, true);
      this.buffer += this.wrapToSpan('&#34;');
    } else {
      this.Node(value);
    }
  }

  TextNode(text: TextNode, isAttr?: boolean): void {
    if (this.handledByOverride(text)) {
      return;
    }

    if (this.options.entityEncoding === 'raw') {
      this.buffer += this.wrapToSpan(text.chars, 'text-node');
    } else if (isAttr) {
      this.buffer += this.wrapToSpan(escapeAttrValue(text.chars), 'text-node');
    } else {
      this.buffer += this.wrapToSpan(escapeText(text.chars), 'text-node');
    }
  }

  MustacheStatement(mustache: MustacheStatement): void {
    if (this.handledByOverride(mustache)) {
      return;
    }

    this.buffer += mustache.escaped
      ? this.wrapToSpan('&#123;&#123;', '&#123;')
      : this.wrapToSpan('&#123;&#123;&#123;', '&#123;');

    if (mustache.strip.open) {
      this.buffer += this.wrapToSpan('&#126;');
    }

    this.Expression(mustache.path);
    this.Params(mustache.params);
    this.Hash(mustache.hash);

    if (mustache.strip.close) {
      this.buffer += this.wrapToSpan('&#126;');
    }

    this.buffer += mustache.escaped
      ? this.wrapToSpan('&#125;&#125;', '&#125;')
      : this.wrapToSpan('&#125;&#125;&#125;', '&#125;');
  }

  BlockStatement(block: BlockStatement): void {
    if (this.handledByOverride(block)) {
      return;
    }

    if (block.chained) {
      this.buffer += block.inverseStrip.open
        ? this.wrapToSpan('&#123;&#123;', '&#123;') + this.wrapToSpan('&#126;')
        : this.wrapToSpan('&#123;&#123;', '&#123;');
      this.buffer += this.wrapToSpan('else') + this.wrapToSpan('&#160;');
    } else {
      this.buffer += block.openStrip.open
        ? this.wrapToSpan('&#123;&#123;', '&#123;') +
        this.wrapToSpan('&#126;') +
        this.wrapToSpan('&#35;')
        : this.wrapToSpan('&#123;&#123;', '&#123;') + this.wrapToSpan('&#35;');
    }

    this.Expression(block.path);
    this.Params(block.params);
    this.Hash(block.hash);
    if (block.program.blockParams.length) {
      this.BlockParams(block.program.blockParams);
    }

    if (block.chained) {
      this.buffer += block.inverseStrip.close
        ? this.wrapToSpan('&#126;') + this.wrapToSpan('&#125;&#125;', '&#125;')
        : this.wrapToSpan('&#125;&#125;', '&#125;');
    } else {
      this.buffer += block.openStrip.close
        ? this.wrapToSpan('&#126;') + this.wrapToSpan('&#125;&#125;', '&#125;')
        : this.wrapToSpan('&#125;&#125;', '&#125;');
    }

    this.Block(block.program);

    if (block.inverse) {
      if (!block.inverse.chained) {
        this.buffer += block.inverseStrip.open
          ? this.wrapToSpan('&#123;&#123;', '&#123;') + this.wrapToSpan('&#126;')
          : this.wrapToSpan('&#123;&#123;', '&#123;');
        this.buffer += this.wrapToSpan('else');
        this.buffer += block.inverseStrip.close
          ? this.wrapToSpan('&#126;') + this.wrapToSpan('&#125;&#125;', '&#125;')
          : this.wrapToSpan('&#125;&#125;', '&#125;');
      }

      this.Block(block.inverse);
    }

    if (!block.chained) {
      this.buffer += block.closeStrip.open
        ? this.wrapToSpan('&#123;&#123;', '&#123;') +
        this.wrapToSpan('&#126;') +
        this.wrapToSpan('&#47;')
        : this.wrapToSpan('&#123;&#123;', '&#123;') + this.wrapToSpan('&#47;');
      this.Expression(block.path);
      this.buffer += block.closeStrip.close
        ? this.wrapToSpan('&#126;') + this.wrapToSpan('&#125;&#125;', '&#125;')
        : this.wrapToSpan('&#125;&#125;', '&#125;');
    }
  }

  BlockParams(blockParams: string[]) {
    this.buffer +=
      `${this.wrapToSpan('&#160;')}${this.wrapToSpan('as')}${this.wrapToSpan(
        '&#160;'
      )}${this.wrapToSpan('&#124;')}${blockParams.join(this.wrapToSpan('&#160;'))}` +
      this.wrapToSpan('&#124;');
  }

  PartialStatement(partial: PartialStatement): void {
    if (this.handledByOverride(partial)) {
      return;
    }

    this.buffer += this.wrapToSpan('&#123;&#123;', '&#123;') + this.wrapToSpan('&#62;');
    this.Expression(partial.name);
    this.Params(partial.params);
    this.Hash(partial.hash);
    this.buffer += this.wrapToSpan('&#125;&#125;', '&#125;');
  }

  ConcatStatement(concat: ConcatStatement): void {
    if (this.handledByOverride(concat)) {
      return;
    }

    this.buffer += this.wrapToSpan('&#34;');
    concat.parts.forEach((part) => {
      if (part.type === 'TextNode') {
        this.TextNode(part, true);
      } else {
        this.Node(part);
      }
    });
    this.buffer += this.wrapToSpan('&#34;');
  }

  MustacheCommentStatement(comment: MustacheCommentStatement): void {
    if (this.handledByOverride(comment)) {
      return;
    }

    this.buffer +=
      this.wrapToSpan('&#123;&#123;', '&#123;') +
      `!--${comment.value}--` +
      this.wrapToSpan('&#125;&#125;', '&#125;');
  }

  ElementModifierStatement(mod: ElementModifierStatement): void {
    if (this.handledByOverride(mod)) {
      return;
    }

    this.buffer += this.wrapToSpan('&#123;&#123;', '&#123;');
    this.Expression(mod.path);
    this.Params(mod.params);
    this.Hash(mod.hash);
    this.buffer += this.wrapToSpan('&#125;&#125;', '&#125;');
  }

  CommentStatement(comment: CommentStatement): void {
    if (this.handledByOverride(comment)) {
      return;
    }

    this.buffer += `${this.wrapToSpan('&#60;')}!--${comment.value}--${this.wrapToSpan('&#62;')}`;
  }

  PathExpression(path: PathExpression): void {
    if (this.handledByOverride(path)) {
      return;
    }

    this.buffer += this.wrapToSpan(path.original, 'path');
  }

  SubExpression(sexp: SubExpression): void {
    if (this.handledByOverride(sexp)) {
      return;
    }

    this.buffer += this.wrapToSpan('&#40;');
    this.Expression(sexp.path);
    this.Params(sexp.params);
    this.Hash(sexp.hash);
    this.buffer += this.wrapToSpan('&#41;');
  }

  Params(params: Expression[]) {
    // TODO: implement a top level Params AST node (just like the Hash object)
    // so that this can also be overridden
    if (params.length) {
      params.forEach((param) => {
        this.buffer += this.wrapToSpan('&#160;');
        this.Expression(param);
      });
    }
  }

  Hash(hash: Hash): void {
    if (this.handledByOverride(hash, true)) {
      return;
    }

    hash.pairs.forEach((pair) => {
      this.buffer += this.wrapToSpan('&#160;');
      this.HashPair(pair);
    });
  }

  HashPair(pair: HashPair): void {
    if (this.handledByOverride(pair)) {
      return;
    }

    this.buffer += this.wrapToSpan(pair.key, 'hash-key');
    this.buffer += this.wrapToSpan('&#61;');
    this.Node(pair.value);
  }

  StringLiteral(str: StringLiteral): void {
    if (this.handledByOverride(str)) {
      return;
    }

    this.buffer += this.wrapToSpan(JSON.stringify(str.value), 'string');
  }

  BooleanLiteral(bool: BooleanLiteral): void {
    if (this.handledByOverride(bool)) {
      return;
    }

    this.buffer += this.wrapToSpan(bool.value.toString(), 'boolean');
  }

  NumberLiteral(number: NumberLiteral): void {
    if (this.handledByOverride(number)) {
      return;
    }

    this.buffer += this.wrapToSpan(number.value.toString(), 'number');
  }

  UndefinedLiteral(node: UndefinedLiteral): void {
    if (this.handledByOverride(node)) {
      return;
    }

    this.buffer += this.wrapToSpan('undefined');
  }

  NullLiteral(node: NullLiteral): void {
    if (this.handledByOverride(node)) {
      return;
    }

    this.buffer += this.wrapToSpan('null');
  }

  print(node: Node) {
    let { options } = this;

    if (options.override) {
      let result = options.override(node, options);

      if (result !== undefined) {
        return result;
      }
    }

    this.buffer = '';
    this.Node(node);
    return this.buffer;
  }
}

function unreachable(node: never, parentNodeType: string): never {
  let { loc, type } = (node as any) as Node;
  throw new Error(
    `Non-exhaustive node narrowing ${type} @ location: ${JSON.stringify(
      loc
    )} for parent ${parentNodeType}`
  );
}
