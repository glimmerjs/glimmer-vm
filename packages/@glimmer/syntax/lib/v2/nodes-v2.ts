// SubExpression | PathExpression | LiteralExpression | Interpolate
import { Builder } from './builders';
import {
  AppendContent,
  CallExpression,
  ElementModifier,
  InvokeBlock,
  PathExpression,
} from './objects';

export type KeywordNode =
  | ElementModifier
  | AppendContent
  | CallExpression
  | PathExpression
  | InvokeBlock;

export { isLiteral } from './objects';
export type {
  AppendContent,
  ArgReference,
  Args,
  AttrBlockNode,
  AttrNode,
  Block,
  CallExpression,
  CallNode,
  ComponentArg,
  ContentNode,
  ElementModifier,
  ElementNode,
  ExpressionNode as Expression,
  ExpressionNode,
  FreeVarReference,
  GlimmerComment,
  HtmlAttr,
  HtmlComment,
  HtmlOrSplatAttr,
  HtmlText,
  InterpolateExpression,
  InvokeBlock,
  InvokeComponent,
  LiteralExpression,
  LocalVarReference,
  Named,
  NamedBlock,
  NamedBlocks,
  NamedEntry,
  PathExpression,
  Positional,
  SimpleElement,
  SplatAttr,
  StringLiteral,
  Template,
  ThisReference,
  VariableReference,
} from './objects';
export { Builder };
