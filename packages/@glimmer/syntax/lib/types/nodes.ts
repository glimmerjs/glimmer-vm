import { Dict, WireFormat, Option } from '@glimmer/interfaces';
import { Span } from './handlebars-ast';

export interface Symbols {
  symbols: string[];

  has(name: string): boolean;
  get(name: string): number;

  getLocalsMap(): Dict<number>;
  getEvalInfo(): WireFormat.Core.EvalInfo;

  allocateNamed(name: string): number;
  allocateBlock(name: string): number;
  allocate(identifier: string): number;

  child(locals: string[]): BlockSymbols;
}

export interface BlockSymbols extends Symbols {
  slots: number[];
}

export interface BaseNode {
  // Every leaf interface that extends BaseNode must specify a type property.
  // The type property should be a string literal. For example, Identifier
  // has: `type: "Identifier"`
  type: NodeType;
  loc: SourceLocation;
  span: Span;
}

export interface SourceLocation {
  source?: Option<string>;
  start: Position;
  end: Position;
}

export interface Position {
  /** >= 1 */
  line: number;
  /** >= 0 */
  column: number;
}

export interface CommonProgram extends BaseNode {
  body: TopLevelStatement[];
  blockParams: string[];
  chained?: boolean;
}

export interface Program extends CommonProgram {
  type: 'Program';
  symbols?: Symbols;
}

export interface Block extends CommonProgram {
  type: 'Block';
  symbols?: BlockSymbols;
}

export interface Template extends CommonProgram {
  type: 'Template';
  symbols?: Symbols;
}

export type PossiblyDeprecatedBlock = Block | Template;

export type Statement =
  | MustacheStatement
  | BlockStatement
  | PartialStatement
  | MustacheCommentStatement
  | CommentStatement
  | TextNode
  | ElementNode;

export type TopLevelStatement =
  | Template
  | Block
  | ElementNode
  | AttrNode
  | TextNode
  | BlockStatement
  | PartialStatement
  | CommentStatement
  | MustacheCommentStatement
  | MustacheStatement;

export interface Call extends BaseNode {
  name?: PathExpression | SubExpression;
  call: Expression;
  params: Expression[];
  hash: Hash;
}

export interface MustacheStatement extends BaseNode {
  type: 'MustacheStatement';
  call: Expression;
  params: Expression[];
  hash: Hash;
  trusted: boolean;
}

export interface MustacheContent extends BaseNode {
  type: 'MustacheContent';
  value: Expression;
  trusted: boolean;
}

export interface BlockStatement extends BaseNode {
  type: 'BlockStatement';
  call: PathExpression;
  params: Expression[];
  hash: Hash;
  program: Block;
  inverse?: Option<Block>;

  // Glimmer extensions
  chained?: boolean;
  symbols?: BlockSymbols;
}

export interface ElementModifierStatement extends BaseNode {
  type: 'ElementModifierStatement';
  call: Expression;
  params: Expression[];
  hash: Hash;
}

export interface PartialStatement extends BaseNode {
  type: 'PartialStatement';
  name: PathExpression | SubExpression;
  params: Expression[];
  hash: Hash;
  indent: string;
  strip: StripFlags;
}

export interface CommentStatement extends BaseNode {
  type: 'CommentStatement';
  value: string;
}

export interface MustacheCommentStatement extends BaseNode {
  type: 'MustacheCommentStatement';
  value: string;
}

export interface ElementNode extends BaseNode {
  type: 'ElementNode';
  tag: string;
  selfClosing: boolean;
  attributes: AttrNode[];
  blockParams: string[];
  modifiers: ElementModifierStatement[];
  comments: MustacheCommentStatement[];
  children: TopLevelStatement[];

  symbols?: BlockSymbols;
}

export interface AttrNode extends BaseNode {
  type: 'AttrNode';
  name: string;
  value: TextNode | MustacheStatement | ConcatStatement;
}

export interface TextNode extends BaseNode {
  type: 'TextNode';
  chars: string;
}

export interface ConcatStatement extends BaseNode {
  type: 'ConcatStatement';
  parts: (TextNode | MustacheStatement)[];
}

export type Expression = SubExpression | PathExpression | Literal;

export interface SubExpression extends Call {
  type: 'SubExpression';
  call: Expression;
  params: Expression[];
  hash: Hash;
}

export interface LocalReference extends BaseNode {
  type: 'LocalReference';
  name: string;
}

export interface ArgReference extends BaseNode {
  type: 'ArgReference';
  name: string;
}

export interface This extends BaseNode {
  type: 'This';
}

export type Head = LocalReference | ArgReference | This;

export interface PathSegment extends BaseNode {
  type: 'PathSegment';
  name: string;
}

export interface PathExpression extends BaseNode {
  type: 'PathExpression';
  head: Head;
  tail: PathSegment[] | null;
}

export interface ArgExpression extends PathExpression {
  type: 'PathExpression';
  head: ArgReference;
  tail: PathSegment[] | null;
}

export type Literal =
  | StringLiteral
  | BooleanLiteral
  | NumberLiteral
  | UndefinedLiteral
  | NullLiteral;

export interface StringLiteral extends BaseNode {
  type: 'StringLiteral';
  value: string;
  original: string;
}

export interface BooleanLiteral extends BaseNode {
  type: 'BooleanLiteral';
  value: boolean;
  original: boolean;
}

export interface NumberLiteral extends BaseNode {
  type: 'NumberLiteral';
  value: number;
  original: number;
}

export interface UndefinedLiteral extends BaseNode {
  type: 'UndefinedLiteral';
  value: undefined;
  original: undefined;
}

export interface NullLiteral extends BaseNode {
  type: 'NullLiteral';
  value: null;
  original: null;
}

export interface Hash extends BaseNode {
  type: 'Hash';
  pairs: HashPair[];
}

export interface HashPair extends BaseNode {
  type: 'HashPair';
  key: string;
  value: Expression;
}

export interface StripFlags {
  open: boolean;
  close: boolean;
}

export interface Nodes {
  Program: Program;
  Template: Template;
  Block: Block;
  CommentStatement: CommentStatement;
  MustacheCommentStatement: MustacheCommentStatement;
  TextNode: TextNode;
  PathExpression: PathExpression;
  StringLiteral: StringLiteral;
  BooleanLiteral: BooleanLiteral;
  NumberLiteral: NumberLiteral;
  NullLiteral: NullLiteral;
  UndefinedLiteral: UndefinedLiteral;
  MustacheStatement: MustacheStatement;
  MustacheContent: MustacheContent;
  BlockStatement: BlockStatement;
  ElementModifierStatement: ElementModifierStatement;
  PartialStatement: PartialStatement;
  ElementNode: ElementNode;
  AttrNode: AttrNode;
  ConcatStatement: ConcatStatement;
  SubExpression: SubExpression;
  Hash: Hash;
  HashPair: HashPair;
  LocalReference: LocalReference;
  ArgReference: ArgReference;
  This: This;
  PathSegment: PathSegment;
}

export type NodeType = keyof Nodes;
export type Node = Nodes[NodeType];
