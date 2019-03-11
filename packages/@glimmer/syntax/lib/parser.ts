import {
  EventedTokenizer,
  EntityParser,
  HTML5NamedCharRefs as namedCharRefs,
} from 'simple-html-tokenizer';
import * as AST from './types/nodes';
import * as hbs from './types/handlebars-ast';
import { Option } from '@glimmer/interfaces';
import { assert, expect } from '@glimmer/util';

const entityParser = new EntityParser(namedCharRefs);

export type Element = AST.Template | AST.Block | AST.ElementNode;

export interface Tag<T extends 'StartTag' | 'EndTag'> {
  type: T;
  name: string;
  attributes: any[];
  modifiers: any[];
  comments: any[];
  selfClosing: boolean;
  loc: AST.SourceLocation;
}

export interface Attribute {
  name: string;
  parts: (AST.MustacheStatement | AST.MustacheContent | AST.TextNode)[];
  isQuoted: boolean;
  isDynamic: boolean;
  start: AST.Position;
  valueStartLine: number;
  valueStartColumn: number;
}

export abstract class Parser {
  protected elementStack: Element[] = [];
  public currentAttribute: Option<Attribute> = null;
  public currentNode: Option<
    AST.CommentStatement | AST.TextNode | Tag<'StartTag' | 'EndTag'>
  > = null;
  public tokenizer = new EventedTokenizer(this, entityParser);

  constructor(protected source: string) {}

  abstract Program(node: hbs.Program): hbs.Program;
  abstract MustacheStatement(node: hbs.MustacheStatement): hbs.MustacheStatement;
  abstract MustacheContent(node: hbs.MustacheContent): hbs.MustacheContent;
  abstract BlockStatement(node: hbs.BlockStatement): hbs.BlockStatement;
  abstract ContentStatement(node: hbs.ContentStatement): hbs.ContentStatement;
  abstract Newline(node: hbs.Newline): hbs.Newline;
  abstract CommentStatement(node: hbs.MustacheCommentStatement): hbs.MustacheCommentStatement;
  abstract SubExpression(node: hbs.SubExpression): hbs.SubExpression;
  abstract PathExpression(node: hbs.PathExpression): hbs.PathExpression;
  abstract StringLiteral(node: hbs.StringLiteral): hbs.StringLiteral;
  abstract BooleanLiteral(node: hbs.BooleanLiteral): hbs.BooleanLiteral;
  abstract NumberLiteral(node: hbs.NumberLiteral): hbs.NumberLiteral;
  abstract UndefinedLiteral(node: hbs.UndefinedLiteral): hbs.UndefinedLiteral;
  abstract NullLiteral(node: hbs.NullLiteral): hbs.NullLiteral;

  abstract reset(): void;
  abstract finishData(): void;
  abstract tagOpen(): void;
  abstract beginData(): void;
  abstract appendToData(char: string): void;
  abstract beginStartTag(): void;
  abstract appendToTagName(char: string): void;
  abstract beginAttribute(): void;
  abstract appendToAttributeName(char: string): void;
  abstract beginAttributeValue(quoted: boolean): void;
  abstract appendToAttributeValue(char: string): void;
  abstract finishAttributeValue(): void;
  abstract markTagAsSelfClosing(): void;
  abstract beginEndTag(): void;
  abstract finishTag(): void;
  abstract beginComment(): void;
  abstract appendToCommentData(char: string): void;
  abstract finishComment(): void;
  abstract reportSyntaxError(error: string): void;

  get currentAttr(): Attribute {
    return expect(this.currentAttribute, 'expected attribute');
  }

  get currentTag(): Tag<'StartTag' | 'EndTag'> {
    let node = this.currentNode;
    assert(node && (node.type === 'StartTag' || node.type === 'EndTag'), 'expected tag');
    return node as Tag<'StartTag' | 'EndTag'>;
  }

  get currentStartTag(): Tag<'StartTag'> {
    let node = this.currentNode;
    assert(node && node.type === 'StartTag', 'expected start tag');
    return node as Tag<'StartTag'>;
  }

  get currentEndTag(): Tag<'EndTag'> {
    let node = this.currentNode;
    assert(node && node.type === 'EndTag', 'expected end tag');
    return node as Tag<'EndTag'>;
  }

  get currentComment(): AST.CommentStatement {
    let node = this.currentNode;
    assert(node && node.type === 'CommentStatement', 'expected a comment');
    return node as AST.CommentStatement;
  }

  get currentData(): AST.TextNode {
    let node = this.currentNode;
    assert(node && node.type === 'TextNode', 'expected a text node');
    return node as AST.TextNode;
  }

  acceptTemplate(node: hbs.AnyProgram): AST.Template {
    return (this as any)[node.type](node) as AST.Template;
  }

  acceptNode(node: hbs.Program): AST.Block | AST.Template;
  acceptNode<U extends hbs.Node | AST.Node>(node: hbs.Node): U;
  acceptNode(node: hbs.Node): any {
    return (this as any)[node.type](node);
  }

  currentElement(): Element {
    return this.elementStack[this.elementStack.length - 1];
  }

  sourceForNode(node: hbs.Node): string {
    if (node.span) {
      return this.source.slice(node.span.start, node.span.end);
    } else {
      return '';
    }
  }
}
