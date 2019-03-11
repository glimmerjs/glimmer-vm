import {
  TokenizerDelegate,
  EventedTokenizer,
  EntityParser,
  HTML5NamedCharRefs,
  TokenizerState,
} from 'simple-html-tokenizer';

import * as hbs from '../../types/handlebars-ast';
import { Option } from '@glimmer/interfaces';
import { expect, assert } from '@glimmer/util';
import { HandlebarsParser } from './core';

const entityParser = new EntityParser(HTML5NamedCharRefs);

type ConstructingParent = ConstructingElement | ConstructingFragment;

class ConstructingFragment {
  readonly description = 'fragment';
  readonly body: hbs.Statement[] = [];

  appendNode(node: hbs.Statement): void {
    this.body.push(node);
  }
}

class ConstructingText {
  readonly description = 'text';
  private text = '';

  constructor(private pos: number) {}

  add(char: string) {
    this.text += char;
  }

  finalize(pos: number): hbs.TextNode {
    return {
      type: 'TextNode',
      span: { start: this.pos, end: pos },
      value: this.text,
    };
  }
}

class ConstructingComment {
  readonly description = 'comment';
  private text = '';

  constructor(private pos: number) {}

  add(char: string) {
    this.text += char;
  }

  finalize(pos: number): hbs.HtmlCommentNode {
    return {
      type: 'HtmlCommentNode',
      span: { start: this.pos, end: pos },
      value: this.text,
    };
  }
}

class ConstructingAttribute {
  readonly description = 'attribute';
  private nameSpan: hbs.Span;
  private quoted = false;
  private valueStart: Option<number> = null;
  private textStart: Option<number> = null;
  private valueStatements: hbs.ConcatContent[] = [];

  constructor(start: number) {
    this.nameSpan = { start, end: start };
  }

  addToName() {
    this.nameSpan.end++;
  }

  openValue(start: number, quoted: boolean) {
    this.valueStart = start;
    this.quoted = quoted;

    this.textStart = quoted ? start + 1 : start;
  }

  addToValue(pos: number) {
    if (this.valueStart === null) {
      throw new Error(`Unexpected addToValue when attribute value is null`);
    }

    if (this.textStart === null) {
      this.textStart = pos;
    }
  }

  addStatementToValue(statement: hbs.ConcatContent, source: string): void {
    let end = statement.span.start;
    let start = this.textStart;

    if (start) {
      let text = source.slice(start, end);
      this.textStart = null;

      if (text.length) {
        let textNode: hbs.TextNode = {
          type: 'TextNode',
          span: { start, end },
          value: text,
        };

        this.valueStatements.push(textNode);
      }
    }

    this.valueStatements.push(statement);
  }

  finalizeStatementWithValue(statement: hbs.ConcatContent, source: string): hbs.AttrNode {
    this.valueStatements.push(statement);
    return this.finalize(statement.span.end, source);
  }

  finalize(pos: number, source: string): hbs.AttrNode {
    let nameSpan = this.nameSpan;

    if (this.textStart !== null && this.textStart !== pos) {
      let text = buildText(this.textStart, this.quoted ? pos - 1 : pos, source);
      this.valueStatements.push(text);
    }

    let content = this.valueStatements;

    let name: hbs.PathSegment = {
      type: 'PathSegment',
      span: this.nameSpan,
      name: source.slice(nameSpan.start, nameSpan.end),
    };

    if (content.length === 0) {
      return {
        type: 'AttrNode',
        name,
        span: nameSpan,
        value: null,
      };
    } else if (isStaticText(content) || isBareMustache(content, this.quoted)) {
      return {
        type: 'AttrNode',
        name,
        span: { start: nameSpan.start, end: pos },
        value: content[0],
      };
    } else {
      let start = expect(this.valueStart, `expected concat value start in concat statement`);
      return {
        type: 'AttrNode',
        name,
        span: { start: nameSpan.start, end: pos },
        value: {
          type: 'ConcatStatement',
          span: { start, end: pos },
          parts: content,
        },
      };
    }
  }
}

function isStaticText(contents: hbs.ConcatContent[]): contents is [hbs.TextNode] {
  if (contents.length !== 1) {
    return false;
  }

  let item = contents[0];

  switch (item.type) {
    case 'TextNode':
      return true;
    default:
      return false;
  }
}

function isBareMustache(
  contents: hbs.ConcatContent[],
  quoted: boolean
): contents is [hbs.ConcatContent] {
  if (quoted) return false;

  if (contents.length !== 1) {
    return false;
  }

  let item = contents[0];

  switch (item.type) {
    case 'TextNode':
      return false;
    default:
      return true;
  }
}

function buildText(start: number, end: number, source: string): hbs.TextNode {
  return {
    type: 'TextNode',
    span: { start, end },
    value: source.slice(start, end),
  };
}

class ConstructingElement {
  readonly description = 'element';
  private startTagNameSpan: Option<hbs.Span> = null;
  private endTagNameSpan: Option<hbs.Span> = null;
  private bodySpan: Option<hbs.Span> = null;
  private attrs: hbs.AttrNode[] = [];
  private maybeAttribute: Option<ConstructingAttribute> = null;
  private body: hbs.Statement[] = [];

  constructor(private start: number) {}

  get attribute(): ConstructingAttribute {
    return expect(this.maybeAttribute, `expected attribute to exist`);
  }

  appendNode(node: hbs.Statement): void {
    this.body.push(node);
  }

  openStartTagName(pos: number) {
    this.startTagNameSpan = { start: pos, end: pos };
  }

  openEndTagName(pos: number) {
    let bodySpan = expect(this.bodySpan, `cannot open an end tag if the body wasn't open`);
    bodySpan.end = pos - 2;

    this.endTagNameSpan = { start: pos, end: pos };
  }

  appendToTagName() {
    if (this.endTagNameSpan) {
      this.endTagNameSpan.end++;
    } else {
      expect(this.startTagNameSpan, `can only append to an open tag name`).end++;
    }
  }

  finishTag(pos: number): boolean {
    if (this.endTagNameSpan) {
      return true;
    } else {
      this.bodySpan = { start: pos, end: pos };
      return false;
    }
  }

  openAttribute(pos: number): void {
    assert(this.maybeAttribute === null, `cannot open an attribute if one is already open`);

    this.maybeAttribute = new ConstructingAttribute(pos);
  }

  appendToAttributeName(): void {
    this.attribute.addToName();
  }

  openAttributeValue(pos: number, quoted: boolean): void {
    this.attribute.openValue(pos, quoted);
  }

  appendTextToAttributeValue(pos: number): void {
    this.attribute.addToValue(pos);
  }

  appendStatementToAttributeValue(statement: hbs.ConcatContent, source: string): void {
    this.attribute.addStatementToValue(statement, source);
  }

  finalizeAttributeWithStatement(statement: hbs.ConcatContent, source: string): void {
    let attr = this.attribute.finalizeStatementWithValue(statement, source);
    this.attrs.push(attr);

    this.maybeAttribute = null;
  }

  closeAttributeValue(pos: number, source: string): void {
    let attr = this.attribute.finalize(pos, source);
    this.attrs.push(attr);

    this.maybeAttribute = null;
  }

  finalize(pos: number, input: string): hbs.ElementNode {
    let startTag = expect(this.startTagNameSpan, `cannot finalize an element without a start tag`);

    let body: Option<hbs.Program> = null;
    if (this.bodySpan) {
      body = {
        type: 'Program',
        span: this.bodySpan,
        call: null,
        body: this.body,
      };
    }

    return {
      type: 'ElementNode',
      span: { start: this.start, end: pos },
      tag: {
        type: 'PathExpression',
        span: startTag,
        head: {
          type: 'LocalReference',
          span: startTag,
          name: input.slice(startTag.start, startTag.end),
        },
        tail: null,
      },
      attributes: this.attrs.length ? this.attrs : null,
      blockParams: null,
      modifiers: null,
      comments: null,
      body,
    };
  }
}

export class ElementStack {
  private elements: ConstructingParent[] = [new ConstructingFragment()];
  private text: Option<ConstructingText> = null;
  private comment: Option<ConstructingComment> = null;
  private htmlParser: HtmlParser;

  constructor(source: string, parser: HandlebarsParser) {
    this.htmlParser = new HtmlParser(source, parser);
  }

  get parent(): ConstructingParent {
    assert(this.elements.length >= 1, `the element stack must not be empty`);

    return this.elements[this.elements.length - 1];
  }

  get element(): ConstructingElement {
    let element = this.parent;

    assert(
      element instanceof ConstructingElement,
      `expected to be constructing an element, got ${element.description}`
    );

    return element as ConstructingElement;
  }

  finalize(pos: number): hbs.Root {
    assert(
      this.elements.length === 1,
      `must have exactly one element in the stack to finalize (TODO: error recovery)`
    );

    let frag = this.elements[0] as ConstructingFragment;

    return {
      type: 'Root',
      span: { start: 0, end: pos },
      body: frag.body,
    };
  }

  seek(from: number): void {
    this.htmlParser.seek(from);
  }

  tokenize(from: number, source: string): void {
    this.htmlParser.seek(from);
    this.htmlParser.tokenizer.tokenizePart(source);

    if (this.htmlParser.tokenizer.state === 'data') {
      this.htmlParser.tokenizer.flushData();
    }
  }

  appendNode(node: hbs.ConcatContent, source: string): void {
    switch (this.htmlParser.tokenizer.state) {
      case TokenizerState.attributeValueSingleQuoted:
      case TokenizerState.attributeValueDoubleQuoted: {
        assert(
          isAttrValue(node),
          `the right hand side of an attribute must be a valid attribute value (text, mustache or concat)`
        );
        this.element.appendStatementToAttributeValue(node, source);
        break;
      }

      case TokenizerState.beforeAttributeValue: {
        assert(
          isAttrValue(node),
          `the right hand side of an attribute must be a valid attribute value (text, mustache or concat)`
        );
        this.element.finalizeAttributeWithStatement(node, source);
        this.htmlParser.tokenizer.transitionTo(TokenizerState.afterAttributeValueQuoted);
        break;
      }
      default:
        this.parent.appendNode(node);
    }
  }

  appendBlock(node: hbs.BlockStatement): void {
    switch (this.htmlParser.tokenizer.state) {
      case TokenizerState.attributeValueSingleQuoted:
      case TokenizerState.attributeValueDoubleQuoted:
      case TokenizerState.beforeAttributeValue: {
        throw new Error(`Can't append a block to an attribute`);
      }
      default:
        this.parent.appendNode(node);
    }
  }

  openBlock() {
    let fragment = new ConstructingFragment();
    this.elements.push(fragment);
  }

  closeBlock(): hbs.Statement[] {
    let fragment = this.elements.pop();
    assert(fragment instanceof ConstructingFragment, `the top of stack should be a block`);
    return (fragment as ConstructingFragment).body;
  }

  openStartTagName(pos: number) {
    let element = new ConstructingElement(pos - 1);
    this.elements.push(element);

    element.openStartTagName(pos);
  }

  openEndTagName(pos: number) {
    this.element.openEndTagName(pos);
  }

  appendToTagName(): void {
    this.element.appendToTagName();
  }

  finishTag(pos: number, input: string): void {
    let end = this.element.finishTag(pos);

    if (end) {
      let element = this.element.finalize(pos, input);
      this.elements.pop();
      this.parent.appendNode(element);
    }
  }

  beginAttribute(pos: number): void {
    this.element.openAttribute(pos);
  }

  appendToAttributeName(): void {
    this.element.appendToAttributeName();
  }

  beginAttributeValue(pos: number, quoted: boolean): void {
    this.element.openAttributeValue(pos, quoted);
  }

  appendToAttributeValue(pos: number): void {
    this.element.appendTextToAttributeValue(pos);
  }

  finishAttributeValue(pos: number, source: string): void {
    this.element.closeAttributeValue(pos, source);
  }

  beginText(pos: number): void {
    this.text = new ConstructingText(pos);
  }

  addToText(char: string): void {
    expect(this.text, `Can't add to unopen text`).add(char);
  }

  finishText(pos: number): void {
    let text = expect(this.text, `Can't finish unopen text`).finalize(pos);
    this.text = null;
    this.parent.appendNode(text);
  }

  beginComment(pos: number): void {
    this.comment = new ConstructingComment(pos - 4);
  }

  addToComment(char: string): void {
    expect(this.comment, `Can't add to unopen comment`).add(char);
  }

  finishComment(pos: number): void {
    let comment = expect(this.comment, `Can't finish unopen comment`).finalize(pos);
    this.comment = null;
    this.parent.appendNode(comment);
  }
}

function isAttrValue(node: hbs.Statement | null): node is hbs.AttrValue {
  if (node === null) return true;

  switch (node.type) {
    case 'TextNode':
    case 'MustacheStatement':
    case 'MustacheContent':
    case 'ConcatStatement':
      return true;
    default:
      return false;
  }
}

export class HtmlParser implements TokenizerDelegate {
  readonly tokenizer = new EventedTokenizer(this, entityParser);

  constructor(private source: string, private parser: HandlebarsParser) {}

  seek(from: number) {
    (this.tokenizer as any).index = from;
    (this.tokenizer as any).input = this.source.slice(0, from);
  }

  get pos() {
    return (this.tokenizer as any).index;
  }

  reset(): void {
    return;
  }

  // open means that we just consumed a character, but the next event consumes the same one
  private trace(desc: string, consume?: 'consume' | 'consumed' | 'open' | 'peek') {
    if (consume === 'consumed') {
      console.log(
        desc,
        this.pos - 1,
        `->`,
        JSON.stringify(this.source.slice(this.pos - 1)),
        this.pos,
        `->`,
        JSON.stringify(this.source.slice(this.pos))
      );
    } else if (consume === 'consume') {
      console.log(
        desc,
        this.pos,
        `->`,
        JSON.stringify(this.source.slice(this.pos)),
        this.pos + 1,
        `->`,
        JSON.stringify(this.source.slice(this.pos + 1))
      );
    } else if (consume === 'open') {
      console.log(desc, this.pos - 1, `->`, JSON.stringify(this.source.slice(this.pos - 1)));
    } else if (consume === 'peek') {
      console.log(desc, this.pos, `->`, JSON.stringify(this.source.slice(this.pos)));
    }
  }

  tagOpen(): void {
    this.trace('tagOpen', 'consume');
  }

  beginData(): void {
    this.trace('beginData');
    this.parser.stack.beginText(this.pos);
  }

  appendToData(char: string): void {
    this.trace('appendToData', 'consumed');
    this.parser.stack.addToText(char);
  }

  finishData(): void {
    this.trace('finishData', 'peek');
    this.parser.stack.finishText(this.pos);
  }

  beginComment(): void {
    this.trace('beginComment');
    this.parser.stack.beginComment(this.pos);
  }

  appendToCommentData(char: string): void {
    this.trace('appendToComment', 'consumed');
    this.parser.stack.addToComment(char);
  }

  finishComment(): void {
    this.trace('finishComment', 'peek');
    this.parser.stack.finishComment(this.pos);
  }

  beginStartTag(): void {
    this.trace('beginStartTag', 'consumed');
    this.parser.stack.openStartTagName(this.pos - 1);
  }

  appendToTagName(): void {
    this.trace('appendToTagName', 'consumed');
    this.parser.stack.appendToTagName();
  }

  markTagAsSelfClosing(): void {
    throw new Error('HtmlParser#markTagAsSelfClosing not implemented.');
  }

  beginEndTag(): void {
    this.trace('beginEndTag', 'open');
    this.parser.stack.openEndTagName(this.pos - 1);
  }

  finishTag(): void {
    this.trace('finishTag', 'consumed');
    this.parser.stack.finishTag(this.pos, this.source);
  }

  beginAttribute(): void {
    this.trace('beginAttribute', 'consumed');
    this.parser.stack.beginAttribute(this.pos);
  }

  appendToAttributeName(): void {
    this.trace('appendToAttributeName', 'consumed');
    this.parser.stack.appendToAttributeName();
  }

  beginAttributeValue(quoted: boolean): void {
    this.trace('beginAttributeValue', 'peek');
    this.parser.stack.beginAttributeValue(this.pos, quoted);
  }

  appendToAttributeValue(_char: string): void {
    this.trace('appendToAttributeValue', 'consumed');
    this.parser.stack.appendToAttributeValue(this.pos - 1);
  }

  finishAttributeValue(): void {
    this.trace('finishAttributeValue', 'peek');
    this.parser.stack.finishAttributeValue(this.pos, this.source);
  }

  reportSyntaxError(error: string): void {
    throw new Error(`HTML tokenization syntax error ${error}`);
  }
}
