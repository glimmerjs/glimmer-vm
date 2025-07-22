import type { SerializedSourceSpan } from '../../source/span';
import type * as ASTv1 from '../../v1/api';
import type { CurlyArgs, UnresolvedBinding } from './args';
import type { ElementModifier } from './attr-block';
import type {
  AppendContent,
  ContentNode,
  InvokeAngleBracketComponent,
  InvokeBlock,
} from './content';
import type {
  CallExpression,
  KeywordExpression,
  PathExpression,
  ResolvedCallExpression,
} from './expr';
import type { BaseNodeFields } from './node';
import type { VariableReference } from './refs';

export interface SerializedBaseNode {
  loc: SerializedSourceSpan;
}

export interface GlimmerParentNodeOptions extends BaseNodeFields {
  body: readonly ContentNode[];
}

export interface CallFields extends BaseNodeFields {
  callee: ASTv1.ParseResult<DynamicCallee | KeywordExpression | UnresolvedBinding>;
  args: CurlyArgs;
}

export type DynamicCallee =
  | KeywordExpression
  | PathExpression
  | VariableReference
  | CallExpression
  | ResolvedCallExpression
  | ASTv1.ErrorNode;

export type CallNode =
  | CallExpression
  | InvokeBlock
  | AppendContent
  | InvokeAngleBracketComponent
  | ElementModifier;
