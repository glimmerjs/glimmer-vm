import {
  EventedTokenizer,
  EntityParser,
  HTML5NamedCharRefs as namedCharRefs,
} from 'simple-html-tokenizer';
import * as AST from './types/nodes';
import * as HBS from './types/handlebars-ast';
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

  abstract Program(node: HBS.Program): HBS.Output<'Program'>;
  abstract MustacheStatement(node: HBS.MustacheStatement): HBS.Output<'MustacheStatement'>;
  abstract MustacheContent(node: HBS.MustacheContent): HBS.Output<'MustacheContent'>;
  abstract BlockStatement(node: HBS.BlockStatement): HBS.Output<'BlockStatement'>;
  abstract ContentStatement(node: HBS.ContentStatement): HBS.Output<'ContentStatement'>;
  abstract Newline(node: HBS.Newline): HBS.Output<'Newline'>;
  abstract CommentStatement(node: HBS.MustacheCommentStatement): HBS.Output<'CommentStatement'>;
  abstract SubExpression(node: HBS.SubExpression): HBS.Output<'SubExpression'>;
  abstract PathExpression(node: HBS.PathExpression): HBS.Output<'PathExpression'>;
  abstract StringLiteral(node: HBS.StringLiteral): HBS.Output<'StringLiteral'>;
  abstract BooleanLiteral(node: HBS.BooleanLiteral): HBS.Output<'BooleanLiteral'>;
  abstract NumberLiteral(node: HBS.NumberLiteral): HBS.Output<'NumberLiteral'>;
  abstract UndefinedLiteral(node: HBS.UndefinedLiteral): HBS.Output<'UndefinedLiteral'>;
  abstract NullLiteral(node: HBS.NullLiteral): HBS.Output<'NullLiteral'>;

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

  acceptTemplate(node: HBS.AnyProgram): AST.Template {
    return (this as any)[node.type](node) as AST.Template;
  }

  acceptNode(node: HBS.Program): AST.Block | AST.Template;
  acceptNode<U extends HBS.Node | AST.Node>(node: HBS.Node): U;
  acceptNode(node: HBS.Node): any {
    return (this as any)[node.type](node);
  }

  currentElement(): Element {
    return this.elementStack[this.elementStack.length - 1];
  }

  sourceForNode(node: HBS.Node): string {
    if (node.span) {
      return this.source.slice(node.span.start, node.span.end);
    } else {
      return '';
    }
  }
}
