import type { SerializedSourceSpan } from '../../source/span';
import type { Args } from './args';
import type { ElementModifier } from './attr-block';
import type { AppendContent, ContentNode, InvokeBlock, InvokeComponent } from './content';
import type { CallExpression, ExpressionNode } from './expr';

export interface SerializedBaseNode {
  loc: SerializedSourceSpan;
}

export interface ParentNodeFields {
  body: readonly ContentNode[];
}

export interface CallNodeFields {
  callee: ExpressionNode;
  args: Args;
}

export type CallNode =
  | CallExpression
  | InvokeBlock
  | AppendContent
  | InvokeComponent
  | ElementModifier;
