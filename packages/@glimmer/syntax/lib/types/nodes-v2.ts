import { Dict, ExpressionContext, Optional, PresentArray, WireFormat } from '@glimmer/interfaces';
import { BlockSymbolTable, ProgramSymbolTable, SymbolTable } from '../symbol-table';

export { default as builders } from '../v2-builders';

export interface Symbols {
  symbols: string[];

  has(name: string): boolean;
  get(name: string): number;

  getLocalsMap(): Dict<number>;
  getEvalInfo(): WireFormat.Core.EvalInfo;

  allocateFree(name: string): number;
  allocateNamed(name: string): number;
  allocateBlock(name: string): number;
  allocate(identifier: string): number;

  child(locals: string[]): BlockSymbols;
}

export interface BlockSymbols extends Symbols {
  slots: number[];
}

export interface ProgramSymbols extends Symbols {
  freeVariables: string[];
}

export interface BaseNode {
  // Every leaf interface that extends BaseNode must specify a type property.
  // The type property should be a string literal. For example, Identifier
  // has: `type: "Identifier"`
  type: NodeType | 'Template';
  loc: SourceLocation;
}

export interface SourceLocation {
  source?: Optional<string>;
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
  body: Statement[];
  chained?: boolean;
}

export interface Block extends CommonProgram {
  type: 'Block';
  symbols: BlockSymbolTable;
}

export type EntityEncodingState = 'transformed' | 'raw';

export interface Template extends CommonProgram {
  type: 'Template';
  symbols: ProgramSymbolTable;
  body: Statement[];
}

export interface Call extends BaseNode {
  type: 'MustacheStatement' | 'BlockStatement' | 'ElementModifierStatement' | 'SubExpression';
  name?: Expression;
  path: Expression;
  params: Expression[];
  hash: Hash;
}

export interface MustacheStatement extends BaseNode {
  type: 'MustacheStatement';
  symbols: SymbolTable;
  path: Expression;
  params: Expression[];
  hash: Hash;
  escaped: boolean;
  strip: StripFlags;
}

export interface BlockStatement extends BaseNode {
  type: 'BlockStatement';
  path: Expression;
  params: Expression[];
  hash: Hash;
  program: Block;
  inverse: Optional<Block>;
  openStrip: StripFlags;
  inverseStrip: StripFlags;
  closeStrip: StripFlags;

  // Printer extension
  chained?: boolean;
}

export interface ElementModifierStatement extends BaseNode {
  type: 'ElementModifierStatement';
  path: Expression;
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

export interface NamedBlockName {
  type: 'NamedBlockName';
  name: string;
  loc: SourceLocation;
}

export interface ElementName {
  type: 'ElementName';
  name: string;
  loc: SourceLocation;
}

export interface BaseElementNode extends BaseNode {
  selfClosing: boolean;
  attributes: AttrNode[];
  modifiers: ElementModifierStatement[];
  comments: MustacheCommentStatement[];
}

export type StatementName =
  | 'MustacheStatement'
  | 'CommentStatement'
  | 'BlockStatement'
  | 'PartialStatement'
  | 'MustacheCommentStatement'
  | 'TextNode'
  | 'SimpleElement'
  | 'NamedBlock'
  | 'Component';

export interface NamedBlockNode extends BaseElementNode {
  type: 'NamedBlock';
  blockName: NamedBlockName;
  children: Statement[];
  symbols: BlockSymbolTable;
}

export interface ComponentNode extends BaseElementNode {
  type: 'Component';
  head: Expression;
  blocks: NamedBlockNode | NamedBlockNode[] | null;
}

export interface SimpleElementNode extends BaseElementNode {
  type: 'SimpleElement';
  tag: string;
  symbols: BlockSymbolTable;
  children: Statement[];
}

export type ElementNode = NamedBlockNode | ComponentNode | SimpleElementNode;

export interface AttrNode extends BaseNode {
  type: 'AttrNode';
  name: string;
  value: Expression;
  trusting: boolean;
}

export interface TextNode extends BaseNode {
  type: 'TextNode';
  chars: string;
}

export interface Interpolate extends BaseNode {
  type: 'Interpolate';
  parts: PresentArray<Expression>;
}

export type ExpressionName = 'SubExpression' | 'PathExpression' | 'Literal' | 'Interpolate';

export interface SubExpression extends Call {
  type: 'SubExpression';
  path: Expression;
  params: Expression[];
  hash: Hash;
}

export interface ThisHead {
  type: 'ThisHead';
  loc?: SourceLocation;
}

export interface AtHead {
  type: 'AtHead';
  name: string;
  loc?: SourceLocation;
}

export interface VarHead {
  type: 'VarHead';
  name: string;
  loc?: SourceLocation;
}

export interface FreeVarHead {
  type: 'FreeVarHead';
  name: string;
  context: ExpressionContext;
  loc?: SourceLocation;
}

export interface LocalVarHead {
  type: 'LocalVarHead';
  name: string;
  loc?: SourceLocation;
}

export type PathHead = ThisHead | AtHead | LocalVarHead | FreeVarHead;

export interface PathExpression extends BaseNode {
  type: 'PathExpression';
  head: PathHead;
  tail: string[];
}

export type LiteralName = 'string' | 'boolean' | 'number' | 'undefined' | 'null';

interface LiteralValues {
  string: string;
  boolean: boolean;
  number: number;
  undefined: undefined;
  null: null;
}

export interface Literal<N extends LiteralName = LiteralName> extends BaseNode {
  type: 'Literal';
  kind: N;
  value: LiteralValues[N];
}

export function isLiteral<N extends LiteralName>(node: Node, kind?: N): node is Literal<N> {
  if (node.type !== 'Literal') {
    return false;
  }

  return kind ? node.kind === kind : true;
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
  Block: Block;
  BlockStatement: BlockStatement;
  NamedBlock: NamedBlockNode;
  Component: ComponentNode;
  SimpleElement: SimpleElementNode;
  CommentStatement: CommentStatement;
  MustacheCommentStatement: MustacheCommentStatement;
  TextNode: TextNode;
  Literal: Literal;
  MustacheStatement: MustacheStatement;
  ElementModifierStatement: ElementModifierStatement;
  PartialStatement: PartialStatement;
  AttrNode: AttrNode;
  Interpolate: Interpolate;
  SubExpression: SubExpression;
  PathExpression: PathExpression;
  Hash: Hash;
  HashPair: HashPair;
}

export type NodeType = keyof Nodes;
export type Node = Nodes[NodeType];

export type Statement = Nodes[StatementName];
export type Expression = Nodes[ExpressionName];
export type TopLevelStatement = Statement | Nodes['Block'];
