// SubExpression | PathExpression | LiteralExpression | Interpolate
import type {
  AppendContent,
  ElementArg,
  Args,
  AttrNode,
  BaseCall,
  Block,
  CallExpression,
  ContentNode,
  ElementModifier,
  ElementNode,
  ExpressionNode,
  GlimmerComment,
  HtmlAttr,
  HtmlComment,
  HtmlText,
  InterpolateExpression,
  InvokeBlock,
  InvokeComponent,
  LiteralExpression,
  Named,
  NamedBlock,
  NamedBlocks,
  NamedEntry,
  PathExpression,
  Positional,
  SimpleElement,
  Template,
  VariableReference,
} from './objects';
import { AttrBlockNode } from './objects/attr-block';

export { default as builders } from './v2-builders';
export type {
  Block,
  LiteralExpression,
  CallExpression,
  PathExpression,
  InterpolateExpression,
  BaseCall as CallNode,
  ExpressionNode as Expression,
  Positional,
  Named,
  NamedEntry,
  Args,
  ContentNode,
  HtmlComment,
  HtmlText,
  HtmlAttr,
  ElementArg as Arg,
  ElementModifier,
  Template,
  AppendContent,
  InvokeBlock,
  InvokeComponent,
  GlimmerComment,
  SimpleElement,
  AttrNode,
  NamedBlock,
  NamedBlocks,
  ElementNode,
  VariableReference,
  AttrBlockNode,
};

export type Node = ContentNode | ExpressionNode | AttrBlockNode;

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
  Arg: ElementArg;
  Interpolate: InterpolateExpression;
  CallExpression: CallExpression;
  PathExpression: PathExpression;
  Named: Named;
  NamedEntry: NamedEntry;
}

// export type NodeType = keyof Nodes;
// export type Node = Nodes[NodeType];
