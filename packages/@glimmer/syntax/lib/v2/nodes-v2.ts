import { assert } from '@glimmer/util';
import { SourceLocation } from '../source/location';
// SubExpression | PathExpression | LiteralExpression | Interpolate
import type {
  AppendContent,
  Args,
  Block,
  CallExpression,
  CallNode,
  ContentNode,
  Expression,
  GlimmerComment,
  HtmlComment,
  InterpolateExpression,
  InvokeBlock,
  InvokeComponent,
  LiteralExpression,
  Named,
  PathExpression,
  Positional,
  SimpleElement,
  Template,
} from './objects';
import { FreeVarResolution, HtmlText, NamedBlock, SourceSlice } from './objects';
import { Arg, AttrNode, ElementModifier, HtmlAttr } from './objects/attr-block';

export { default as builders } from './v2-builders';
export type {
  Block,
  LiteralExpression,
  CallExpression,
  PathExpression,
  InterpolateExpression,
  CallNode,
  Expression,
  Positional,
  Named,
  Args,
  ContentNode,
  HtmlComment,
  HtmlText,
  HtmlAttr,
  Arg,
  ElementModifier,
  Template,
  AppendContent,
  InvokeBlock,
  InvokeComponent,
  GlimmerComment,
  SimpleElement,
  AttrNode,
  NamedBlock,
};

export interface BaseNode {
  // Every leaf interface that extends BaseNode must specify a type property.
  // The type property should be a string literal. For example, Identifier
  // has: `type: "Identifier"`
  type: NodeType | 'Template';
  loc: SourceLocation;
}

export function hasBlock(blocks: NamedBlock[], name: string): boolean {
  return !!blocks.find((block) => block.name.chars === name);
}

export function getBlock(blocks: NamedBlock[], name: string): NamedBlock {
  let block = blocks.find((block) => block.name.chars === name);

  assert(
    block !== undefined,
    `getBlock() should only be called for a guaranteed block; call hasBlock() first`
  );

  return block;
}

export type ElementNode = NamedBlock | InvokeComponent | SimpleElement;

export type ExpressionName = 'SubExpression' | 'PathExpression' | 'LiteralExpression';
export type InternalExpressionName = ExpressionName | 'Interpolate';

export interface ThisReference {
  type: 'ThisReference';
  loc?: SourceLocation;
}

export interface ArgReference {
  type: 'ArgReference';
  name: SourceSlice;
  loc?: SourceLocation;
}

export interface FreeVarReference {
  type: 'FreeVarReference';
  name: string;
  resolution: FreeVarResolution;
  loc?: SourceLocation;
}

export interface LocalVarReference {
  type: 'LocalVarReference';
  name: string;
  loc?: SourceLocation;
}

export type VariableReference = ThisReference | ArgReference | LocalVarReference | FreeVarReference;

export interface NamedEntry extends BaseNode {
  type: 'NamedEntry';
  name: SourceSlice;
  value: Expression;
}

export interface StripFlags {
  open: boolean;
  close: boolean;
}

export interface Nodes {
  Block: Block;
  InvokeBlock: InvokeBlock;
  NamedBlock: NamedBlock;
  InvokeComponent: InvokeComponent;
  SimpleElement: SimpleElement;
  HtmlComment: HtmlComment;
  GlimmerComment: GlimmerComment;
  HtmlText: HtmlText;
  LiteralExpression: LiteralExpression;
  AppendContent: AppendContent;
  ElementModifier: ElementModifier;
  HtmlAttr: HtmlAttr;
  Arg: Arg;
  Interpolate: InterpolateExpression;
  CallExpression: CallExpression;
  PathExpression: PathExpression;
  Named: Named;
  NamedEntry: NamedEntry;
}

export type NodeType = keyof Nodes;
export type Node = Nodes[NodeType];
