import { Optional } from '@glimmer/interfaces';
import { assert, assign, expect } from '@glimmer/util';
import {
  EntityParser,
  EventedTokenizer,
  HTML5NamedCharRefs as namedCharRefs,
} from 'simple-html-tokenizer';
import type { SourceOffset, SourceOffsets } from './source/offsets/abstract';
import { LazySourceOffset } from './source/offsets/lazy';
import { Source } from './source/source';
import * as AST from './types/api';
import * as HBS from './types/handlebars-ast';

export type Builder<N extends { loc: SourceOffsets }> = Omit<N, 'loc'> & { loc: SourceOffset };

export type Element = AST.Template | AST.Block | AST.ElementNode;

export interface Tag<T extends 'StartTag' | 'EndTag'> {
  type: T;
  name: string;
  attributes: AST.AttrNode[];
  modifiers: AST.ElementModifierStatement[];
  comments: AST.MustacheCommentStatement[];
  selfClosing: boolean;
  loc: SourceOffsets;
}

export interface Attribute {
  name: string;
  currentPart: AST.TextNode | null;
  parts: (AST.MustacheStatement | AST.TextNode)[];
  isQuoted: boolean;
  isDynamic: boolean;
  start: SourceOffset;
  valueOffsets: SourceOffsets;
}

export abstract class Parser {
  protected elementStack: Element[] = [];
  private lines: string[];
  readonly source: Source;
  public currentAttribute: Optional<Attribute> = null;
  public currentNode: Optional<
    Builder<AST.CommentStatement> | AST.TextNode | Builder<Tag<'StartTag'>> | Builder<Tag<'EndTag'>>
  > = null;
  public tokenizer: EventedTokenizer;

  constructor(source: string, entityParser = new EntityParser(namedCharRefs)) {
    this.source = new Source(source);
    this.lines = source.split(/(?:\r\n?|\n)/g);
    this.tokenizer = new EventedTokenizer(this, entityParser);
  }

  offset(): LazySourceOffset {
    return this.source.offsetFor(this.tokenizer);
  }

  pos(pos: AST.SourcePosition): LazySourceOffset {
    return this.source.offsetFor(pos);
  }

  finish<T extends { loc: SourceOffsets }>(node: Builder<T>, end: SourceOffset): T {
    return (assign(node, {
      loc: node.loc.withEnd(end),
    } as const) as unknown) as T;

    // node.loc = node.loc.withEnd(end);
  }

  abstract Program(node: HBS.Program): HBS.Output<'Program'>;
  abstract MustacheStatement(node: HBS.MustacheStatement): HBS.Output<'MustacheStatement'>;
  abstract Decorator(node: HBS.Decorator): HBS.Output<'Decorator'>;
  abstract BlockStatement(node: HBS.BlockStatement): HBS.Output<'BlockStatement'>;
  abstract DecoratorBlock(node: HBS.DecoratorBlock): HBS.Output<'DecoratorBlock'>;
  abstract PartialStatement(node: HBS.PartialStatement): HBS.Output<'PartialStatement'>;
  abstract PartialBlockStatement(
    node: HBS.PartialBlockStatement
  ): HBS.Output<'PartialBlockStatement'>;
  abstract ContentStatement(node: HBS.ContentStatement): HBS.Output<'ContentStatement'>;
  abstract CommentStatement(node: HBS.CommentStatement): HBS.Output<'CommentStatement'>;
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

  get currentTag(): Builder<Tag<'StartTag' | 'EndTag'>> {
    let node = this.currentNode;
    assert(node && (node.type === 'StartTag' || node.type === 'EndTag'), 'expected tag');
    return node;
  }

  get currentStartTag(): Builder<Tag<'StartTag'>> {
    let node = this.currentNode;
    assert(node && node.type === 'StartTag', 'expected start tag');
    return node;
  }

  get currentEndTag(): Builder<Tag<'EndTag'>> {
    let node = this.currentNode;
    assert(node && node.type === 'EndTag', 'expected end tag');
    return node;
  }

  get currentComment(): Builder<AST.CommentStatement> {
    let node = this.currentNode;
    assert(node && node.type === 'CommentStatement', 'expected a comment');
    return node;
  }

  get currentData(): AST.TextNode {
    let node = this.currentNode;
    assert(node && node.type === 'TextNode', 'expected a text node');
    return node;
  }

  acceptTemplate(node: HBS.Program): AST.Template {
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

  sourceForNode(node: HBS.Node, endNode?: { loc: HBS.SourceLocation }): string {
    let firstLine = node.loc.start.line - 1;
    let currentLine = firstLine - 1;
    let firstColumn = node.loc.start.column;
    let string = [];
    let line;

    let lastLine: number;
    let lastColumn: number;

    if (endNode) {
      lastLine = endNode.loc.end.line - 1;
      lastColumn = endNode.loc.end.column;
    } else {
      lastLine = node.loc.end.line - 1;
      lastColumn = node.loc.end.column;
    }

    while (currentLine < lastLine) {
      currentLine++;
      line = this.lines[currentLine];

      if (currentLine === firstLine) {
        if (firstLine === lastLine) {
          string.push(line.slice(firstColumn, lastColumn));
        } else {
          string.push(line.slice(firstColumn));
        }
      } else if (currentLine === lastLine) {
        string.push(line.slice(0, lastColumn));
      } else {
        string.push(line);
      }
    }

    return string.join('\n');
  }
}
