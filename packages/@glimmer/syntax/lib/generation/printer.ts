import type * as ASTv1 from '../v1/api';

import { escapeAttrValue, escapeText, sortByLoc } from './util';

export const voidMap = new Set([
  'area',
  'base',
  'br',
  'col',
  'command',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

export function getVoidTags() {
  return [...voidMap];
}

const NON_WHITESPACE = /^\S/u;

export interface PrinterOptions {
  entityEncoding: ASTv1.EntityEncodingState;

  /**
   * Used to override the mechanism of printing a given AST.Node.
   *
   * This will generally only be useful to source -> source codemods
   * where you would like to specialize/override the way a given node is
   * printed (e.g. you would like to preserve as much of the original
   * formatting as possible).
   *
   * When the provided override returns undefined, the default built in printing
   * will be done for the AST.Node.
   *
   * @param ast the ast node to be printed
   * @param options the options specified during the print() invocation
   */
  override?(ast: ASTv1.Node, options: PrinterOptions): void | string;
}

/**
 * Examples when true:
 *  - link
 *  - liNK
 *
 * Examples when false:
 *  - Link (component)
 */
export function isVoidTag(tag: string): boolean {
  return voidMap.has(tag.toLowerCase()) && tag[0]?.toLowerCase() === tag[0];
}

export default class Printer {
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
  handledByOverride(node: ASTv1.Node, ensureLeadingWhitespace = false): boolean {
    if (this.options.override !== undefined) {
      let result = this.options.override(node, this.options);
      if (typeof result === 'string') {
        if (ensureLeadingWhitespace && NON_WHITESPACE.test(result)) {
          result = ` ${result}`;
        }

        this.buffer += result;
        return true;
      }
    }

    return false;
  }

  Node(node: ASTv1.Node): void {
    switch (node.type) {
      case 'MustacheStatement':
      case 'BlockStatement':
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
  }

  Expression(expression: ASTv1.Expression): void {
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
  }

  Literal(literal: ASTv1.Literal): void {
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
  }

  TopLevelStatement(statement: ASTv1.TopLevelStatement | ASTv1.Template | ASTv1.AttrNode): void {
    switch (statement.type) {
      case 'MustacheStatement':
        return this.MustacheStatement(statement);
      case 'BlockStatement':
        return this.BlockStatement(statement);
      case 'MustacheCommentStatement':
        return this.MustacheCommentStatement(statement);
      case 'CommentStatement':
        return this.CommentStatement(statement);
      case 'TextNode':
        return this.TextNode(statement);
      case 'ElementNode':
        return this.ElementNode(statement);
      case 'Block':
        return this.Block(statement);
      case 'Template':
        return this.Template(statement);
      case 'AttrNode':
        // should have element
        return this.AttrNode(statement);
    }
  }

  Template(template: ASTv1.Template): void {
    this.TopLevelStatements(template.body);
  }

  Block(block: ASTv1.Block): void {
    /*
      When processing a template like:

      ```hbs
      {{#if whatever}}
        whatever
      {{else if somethingElse}}
        something else
      {{else}}
        fallback
      {{/if}}
      ```

      The AST still _effectively_ looks like:

      ```hbs
      {{#if whatever}}
        whatever
      {{else}}{{#if somethingElse}}
        something else
      {{else}}
        fallback
      {{/if}}{{/if}}
      ```

      The only way we can tell if that is the case is by checking for
      `block.chained`, but unfortunately when the actual statements are
      processed the `block.body[0]` node (which will always be a
      `BlockStatement`) has no clue that its ancestor `Block` node was
      chained.

      This "forwards" the `chained` setting so that we can check
      it later when processing the `BlockStatement`.
    */
    if (block.chained) {
      let firstChild = block.body[0] as ASTv1.BlockStatement;
      firstChild.chained = true;
    }

    if (this.handledByOverride(block)) {
      return;
    }

    this.TopLevelStatements(block.body);
  }

  TopLevelStatements(statements: ASTv1.TopLevelStatement[]): void {
    statements.forEach((statement) => this.TopLevelStatement(statement));
  }

  ElementNode(el: ASTv1.ElementNode): void {
    if (this.handledByOverride(el)) {
      return;
    }

    this.OpenElementNode(el);
    this.TopLevelStatements(el.children);
    this.CloseElementNode(el);
  }

  OpenElementNode(el: ASTv1.ElementNode): void {
    this.buffer += `<${el.tag}`;
    const parts = [...el.attributes, ...el.modifiers, ...el.comments].sort(sortByLoc);

    for (const part of parts) {
      this.buffer += ' ';
      switch (part.type) {
        case 'AttrNode':
          this.AttrNode(part);
          break;
        case 'ElementModifierStatement':
          this.ElementModifierStatement(part);
          break;
        case 'MustacheCommentStatement':
          this.MustacheCommentStatement(part);
          break;
      }
    }
    if (el.blockParams.length) {
      this.BlockParams(el.blockParams);
    }
    if (el.selfClosing) {
      this.buffer += ' /';
    }
    this.buffer += '>';
  }

  CloseElementNode(el: ASTv1.ElementNode): void {
    if (el.selfClosing || isVoidTag(el.tag)) {
      return;
    }
    this.buffer += `</${el.tag}>`;
  }

  AttrNode(attr: ASTv1.AttrNode): void {
    if (this.handledByOverride(attr)) {
      return;
    }

    let { name, value } = attr;

    this.buffer += name;
    const isAttribute = !name.startsWith('@');
    const shouldElideValue = isAttribute && value.type == 'TextNode' && value.chars.length === 0;
    if (!shouldElideValue) {
      this.buffer += '=';
      this.AttrNodeValue(value);
    }
  }

  AttrNodeValue(value: ASTv1.AttrNode['value']): void {
    if (value.type === 'TextNode') {
      let quote: '"' | "'" = '"';
      if (this.options.entityEncoding === 'raw') {
        if (value.chars.includes('"') && !value.chars.includes("'")) {
          quote = "'";
        }
      }
      this.buffer += quote;
      this.TextNode(value, quote);
      this.buffer += quote;
    } else {
      this.Node(value);
    }
  }

  TextNode(text: ASTv1.TextNode, isInAttr?: "'" | '"'): void {
    if (this.handledByOverride(text)) {
      return;
    }

    if (this.options.entityEncoding === 'raw') {
      if (isInAttr && text.chars.includes(isInAttr)) {
        this.buffer += escapeAttrValue(text.chars);
      } else {
        this.buffer += text.chars;
      }
    } else if (isInAttr) {
      this.buffer += escapeAttrValue(text.chars);
    } else {
      this.buffer += escapeText(text.chars);
    }
  }

  MustacheStatement(mustache: ASTv1.MustacheStatement): void {
    if (this.handledByOverride(mustache)) {
      return;
    }

    this.buffer += mustache.trusting ? '{{{' : '{{';

    if (mustache.strip.open) {
      this.buffer += '~';
    }

    this.Expression(mustache.path);
    this.Params(mustache.params);
    this.Hash(mustache.hash);

    if (mustache.strip.close) {
      this.buffer += '~';
    }

    this.buffer += mustache.trusting ? '}}}' : '}}';
  }

  BlockStatement(block: ASTv1.BlockStatement): void {
    if (this.handledByOverride(block)) {
      return;
    }

    if (block.chained) {
      this.buffer += block.inverseStrip.open ? '{{~' : '{{';
      this.buffer += 'else ';
    } else {
      this.buffer += block.openStrip.open ? '{{~#' : '{{#';
    }

    this.Expression(block.path);
    this.Params(block.params);
    this.Hash(block.hash);
    if (block.program.blockParams.length) {
      this.BlockParams(block.program.blockParams);
    }

    if (block.chained) {
      this.buffer += block.inverseStrip.close ? '~}}' : '}}';
    } else {
      this.buffer += block.openStrip.close ? '~}}' : '}}';
    }

    this.Block(block.program);

    if (block.inverse) {
      if (!block.inverse.chained) {
        this.buffer += block.inverseStrip.open ? '{{~' : '{{';
        this.buffer += 'else';
        this.buffer += block.inverseStrip.close ? '~}}' : '}}';
      }

      this.Block(block.inverse);
    }

    if (!block.chained) {
      this.buffer += block.closeStrip.open ? '{{~/' : '{{/';
      this.Expression(block.path);
      this.buffer += block.closeStrip.close ? '~}}' : '}}';
    }
  }

  BlockParams(blockParams: string[]): void {
    this.buffer += ` as |${blockParams.join(' ')}|`;
  }

  ConcatStatement(concat: ASTv1.ConcatStatement): void {
    if (this.handledByOverride(concat)) {
      return;
    }

    this.buffer += '"';
    concat.parts.forEach((part) => {
      if (part.type === 'TextNode') {
        this.TextNode(part, '"');
      } else {
        this.Node(part);
      }
    });
    this.buffer += '"';
  }

  MustacheCommentStatement(comment: ASTv1.MustacheCommentStatement): void {
    if (this.handledByOverride(comment)) {
      return;
    }

    this.buffer += `{{!--${comment.value}--}}`;
  }

  ElementModifierStatement(mod: ASTv1.ElementModifierStatement): void {
    if (this.handledByOverride(mod)) {
      return;
    }

    this.buffer += '{{';
    this.Expression(mod.path);
    this.Params(mod.params);
    this.Hash(mod.hash);
    this.buffer += '}}';
  }

  CommentStatement(comment: ASTv1.CommentStatement): void {
    if (this.handledByOverride(comment)) {
      return;
    }

    this.buffer += `<!--${comment.value}-->`;
  }

  PathExpression(path: ASTv1.PathExpression): void {
    if (this.handledByOverride(path)) {
      return;
    }

    this.buffer += path.original;
  }

  SubExpression(sexp: ASTv1.SubExpression): void {
    if (this.handledByOverride(sexp)) {
      return;
    }

    this.buffer += '(';
    this.Expression(sexp.path);
    this.Params(sexp.params);
    this.Hash(sexp.hash);
    this.buffer += ')';
  }

  Params(params: ASTv1.Expression[]): void {
    // TODO: implement a top level Params AST node (just like the Hash object)
    // so that this can also be overridden
    if (params.length) {
      params.forEach((param) => {
        this.buffer += ' ';
        this.Expression(param);
      });
    }
  }

  Hash(hash: ASTv1.Hash): void {
    if (this.handledByOverride(hash, true)) {
      return;
    }

    hash.pairs.forEach((pair) => {
      this.buffer += ' ';
      this.HashPair(pair);
    });
  }

  HashPair(pair: ASTv1.HashPair): void {
    if (this.handledByOverride(pair)) {
      return;
    }

    this.buffer += pair.key;
    this.buffer += '=';
    this.Node(pair.value);
  }

  StringLiteral(str: ASTv1.StringLiteral): void {
    if (this.handledByOverride(str)) {
      return;
    }

    this.buffer += JSON.stringify(str.value);
  }

  BooleanLiteral(bool: ASTv1.BooleanLiteral): void {
    if (this.handledByOverride(bool)) {
      return;
    }

    this.buffer += String(bool.value);
  }

  NumberLiteral(number: ASTv1.NumberLiteral): void {
    if (this.handledByOverride(number)) {
      return;
    }

    this.buffer += String(number.value);
  }

  UndefinedLiteral(node: ASTv1.UndefinedLiteral): void {
    if (this.handledByOverride(node)) {
      return;
    }

    this.buffer += 'undefined';
  }

  NullLiteral(node: ASTv1.NullLiteral): void {
    if (this.handledByOverride(node)) {
      return;
    }

    this.buffer += 'null';
  }

  print(node: ASTv1.Node): string {
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
