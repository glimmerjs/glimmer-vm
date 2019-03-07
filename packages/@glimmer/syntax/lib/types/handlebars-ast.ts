/**
 * @module
 *
 * This file contains types for the raw AST returned from the Handlebars parser.
 * These types were originally imported from
 * https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/handlebars/index.d.ts.
 */

import * as AST from './nodes';

export interface Span {
  start: number;
  end: number;
}

export interface CommonNode {
  span: Span;
}

export interface NodeMap {
  Root: { input: Root; output: AST.Template };
  Program: { input: Program; output: AST.Template | AST.Block };
  MustacheStatement: { input: MustacheStatement; output: AST.MustacheStatement | void };
  MustacheContent: { input: MustacheContent; output: AST.MustacheContent | void };
  BlockStatement: { input: BlockStatement; output: AST.BlockStatement | void };
  ContentStatement: { input: ContentStatement; output: void };
  Newline: { input: Newline; output: void };
  CommentStatement: {
    input: MustacheCommentStatement;
    output: AST.MustacheCommentStatement | null;
  };
  SubExpression: { input: SubExpression; output: AST.SubExpression };
  PathExpression: { input: PathExpression; output: AST.PathExpression };
  StringLiteral: { input: StringLiteral; output: AST.StringLiteral };
  BooleanLiteral: { input: BooleanLiteral; output: AST.BooleanLiteral };
  NumberLiteral: { input: NumberLiteral; output: AST.NumberLiteral };
  UndefinedLiteral: { input: UndefinedLiteral; output: AST.UndefinedLiteral };
  NullLiteral: { input: NullLiteral; output: AST.NullLiteral };
}

export type NodeType = keyof NodeMap;
export type Node<T extends NodeType = NodeType> = NodeMap[T]['input'];

export type AnyNode =
  | Node
  | Head
  | BlockParams
  | HtmlCommentNode
  | PathSegment
  | Hash
  | HashPair
  | AttrNode
  | ConcatStatement
  | AnyProgram;

export type Output<T extends NodeType> = NodeMap[T]['output'];

export interface SourceLocation {
  source: string;
  start: Position;
  end: Position;
}

export interface Position {
  line: number;
  column: number;
}

export interface AnyProgram {
  span: Span | null;
  type: 'Program' | 'Inverse' | 'Root';
  body: Statement[] | null;
}

export interface Root {
  span: Span;
  type: 'Root';
  body: Statement[] | null;
}

export interface Program {
  span: Span;
  type: 'Program';
  call: CallBody | null;
  body: Statement[] | null;
}

export interface BlockParams {
  span: Span;
  type: 'BlockParams';
  params: PathSegment[];
}

export type Statement =
  | MustacheStatement
  | MustacheContent
  | BlockStatement
  | ElementNode
  | TextNode
  | ConcatStatement
  | HtmlCommentNode
  | Newline
  | MustacheCommentStatement;

export interface MustacheStatement extends CommonNode {
  type: 'MustacheStatement';
  body: CallBody;
  trusted: boolean;
}

export interface CallBody {
  type: 'CallBody';
  span: Span;
  call: Expression;
  params: Expression[] | null;
  hash: Hash | null;
  blockParams: BlockParams | null;
}

export interface MustacheContent extends CommonNode {
  type: 'MustacheContent';
  value: Expression;
  trusted: boolean;
}

export interface CommonBlock extends CommonNode {
  program: Program;
  inverses: Program[] | null;
}

export interface BlockStatement extends CommonBlock {
  type: 'BlockStatement';
}

export interface ContentStatement extends CommonNode {
  type: 'ContentStatement';
  value: string;
}

export interface TextNode extends CommonNode {
  type: 'TextNode';
  value: string;
}

export interface HtmlCommentNode extends CommonNode {
  type: 'HtmlCommentNode';
  value: string;
}

export interface ElementNode extends CommonNode {
  type: 'ElementNode';
  tag: Expression;
  attributes: AttrNode[] | null;
  blockParams: BlockParams | null;
  modifiers: ElementModifierStatement[] | null;
  comments: MustacheCommentStatement[] | null;
  body: Program | null;
}

export type AttrValue = ConcatContent | ConcatStatement | null;

export interface AttrNode extends CommonNode {
  type: 'AttrNode';
  name: PathSegment;
  value: AttrValue;
}

export type ConcatContent =
  | TextNode
  | MustacheStatement
  | MustacheCommentStatement
  | MustacheContent;

export interface ConcatStatement extends CommonNode {
  type: 'ConcatStatement';
  parts: ConcatContent[];
}

export interface ElementModifierStatement extends CommonNode {
  type: 'ElementModifierStatement';
  call: Expression;
  params: Expression[];
  hash: Hash;
}

export interface Newline extends CommonNode {
  type: 'Newline';
}

export interface MustacheCommentStatement extends CommonNode {
  type: 'CommentStatement';
  value: string;
}

export type Expression = SubExpression | PathExpression | Literal;

export interface SubExpression extends CommonNode {
  type: 'SubExpression';
  body: CallBody;
}

export interface PathExpression extends CommonNode {
  type: 'PathExpression';
  head: Head;
  tail: PathSegment[] | null;
}

export interface LocalReference extends CommonNode {
  type: 'LocalReference';
  name: string;
}

export interface ArgReference extends CommonNode {
  type: 'ArgReference';
  name: string;
}

export interface This extends CommonNode {
  type: 'This';
}

export type Head = LocalReference | ArgReference | This;

export interface PathSegment extends CommonNode {
  type: 'PathSegment';
  name: string;
}

export type Literal =
  | StringLiteral
  | BooleanLiteral
  | NumberLiteral
  | UndefinedLiteral
  | NullLiteral;

export interface StringLiteral extends CommonNode {
  type: 'StringLiteral';
  value: string;
}

export interface BooleanLiteral extends CommonNode {
  type: 'BooleanLiteral';
  value: boolean;
}

export interface NumberLiteral extends CommonNode {
  type: 'NumberLiteral';
  value: number;
}

export interface UndefinedLiteral extends CommonNode {
  type: 'UndefinedLiteral';
  value: undefined;
}

export interface NullLiteral extends CommonNode {
  type: 'NullLiteral';
  value: null;
}

export interface Hash extends CommonNode {
  type: 'Hash';
  pairs: HashPair[];
}

export interface HashPair extends CommonNode {
  type: 'HashPair';
  key: string;
  value: Expression;
}
