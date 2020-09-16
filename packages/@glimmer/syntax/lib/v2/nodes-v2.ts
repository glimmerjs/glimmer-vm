import {
  Dict,
  Optional,
  PresentArray,
  VariableResolutionContext,
  WireFormat,
} from '@glimmer/interfaces';
import { assert } from '@glimmer/util';
import { BlockSymbolTable, ProgramSymbolTable, SymbolTable } from '../symbol-table';

export { default as builders } from './v2-builders';

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
}

export interface Block extends CommonProgram {
  type: 'Block';
  table: BlockSymbolTable;
}

export type EntityEncodingState = 'transformed' | 'raw';

export interface Template extends CommonProgram {
  type: 'Template';
  table: ProgramSymbolTable;
  body: Statement[];
}

export type CallNodeName =
  | 'AppendStatement'
  | 'BlockStatement'
  | 'ElementModifierStatement'
  | 'SubExpression';

export interface CallNode extends BaseNode {
  type: CallNodeName;
  func: Expression;
  params: InternalExpression[];
  hash: Hash;
}

export function isCall(node: BaseNode): node is CallNode {
  switch (node.type) {
    case 'BlockStatement':
    case 'ElementModifierStatement':
    case 'SubExpression':
      return true;
    default:
      return false;
  }
}

export interface AppendStatement extends BaseNode {
  type: 'AppendStatement';
  value: Expression;
  table: SymbolTable;
  trusting: boolean;
}

export interface BlockStatement extends CallNode {
  type: 'BlockStatement';
  blocks: PresentArray<NamedBlock>;
}

export function hasBlock(blocks: NamedBlock[], name: string): boolean {
  return !!blocks.find((block) => block.blockName.name === name);
}

export function getBlock(blocks: NamedBlock[], name: string): NamedBlock {
  let block = blocks.find((block) => block.blockName.name === name);

  assert(
    block !== undefined,
    `getBlock() should only be called for a guaranteed block; call hasBlock() first`
  );

  return block;
}

export interface ElementModifierStatement extends CallNode {
  type: 'ElementModifierStatement';
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
  | 'AppendStatement'
  | 'CommentStatement'
  | 'BlockStatement'
  | 'MustacheCommentStatement'
  | 'TextNode'
  | 'SimpleElement'
  | 'Component';

export interface NamedBlock extends BaseNode {
  type: 'NamedBlock';
  blockName: NamedBlockName;
  block: Block;
  attributes: AttrNode[];
  modifiers: ElementModifierStatement[];
  comments: MustacheCommentStatement[];
}

export interface Component extends BaseElementNode {
  type: 'Component';
  head: InternalExpression;
  blocks: NamedBlock | NamedBlock[] | null;
}

export interface SimpleElement extends BaseElementNode {
  type: 'SimpleElement';
  tag: string;
  children: Statement[];
}

export type ElementNode = NamedBlock | Component | SimpleElement;

export interface AttrNode extends BaseNode {
  type: 'AttrNode';
  name: string;
  value: InternalExpression;
  trusting: boolean;
}

export interface TextNode extends BaseNode {
  type: 'TextNode';
  chars: string;
}

export interface Interpolate extends BaseNode {
  type: 'Interpolate';
  parts: PresentArray<InternalExpression>;
}

export type ExpressionName = 'SubExpression' | 'PathExpression' | 'Literal';
export type InternalExpressionName = ExpressionName | 'Interpolate';

export interface SubExpression extends CallNode {
  type: 'SubExpression';
}

export interface ThisReference {
  type: 'ThisHead';
  loc?: SourceLocation;
}

export interface ArgReference {
  type: 'AtHead';
  name: string;
  loc?: SourceLocation;
}

export interface VarHead {
  type: 'VarHead';
  name: string;
  loc?: SourceLocation;
}

export interface FreeVarReference {
  type: 'FreeVarHead';
  name: string;
  context: VariableResolutionContext;
  loc?: SourceLocation;
}

export interface LocalVarReference {
  type: 'LocalVarHead';
  name: string;
  loc?: SourceLocation;
}

export type VariableReference = ThisReference | ArgReference | LocalVarReference | FreeVarReference;

export interface PathExpression extends BaseNode {
  type: 'PathExpression';
  ref: VariableReference;
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
  value: InternalExpression;
}

export interface StripFlags {
  open: boolean;
  close: boolean;
}

export interface Nodes {
  Block: Block;
  BlockStatement: BlockStatement;
  NamedBlock: NamedBlock;
  Component: Component;
  SimpleElement: SimpleElement;
  CommentStatement: CommentStatement;
  MustacheCommentStatement: MustacheCommentStatement;
  TextNode: TextNode;
  Literal: Literal;
  AppendStatement: AppendStatement;
  ElementModifierStatement: ElementModifierStatement;
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
export type InternalExpression = Nodes[InternalExpressionName];
export type CallExpression = Nodes[CallNodeName];
export type TopLevelStatement = Statement | Nodes['Block'];
