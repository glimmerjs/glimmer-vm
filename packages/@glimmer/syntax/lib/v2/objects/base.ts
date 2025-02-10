import type { SerializedSourceSpan } from '../../source/span';
import type { Args } from './args';
import type { ElementModifier } from './attr-block';
import type {
  AppendContent,
  ContentNode,
  InvokeAngleBracketComponent,
  InvokeBlock,
} from './content';
import type { CallExpression, ExpressionNode, KeywordExpression, PathExpression } from './expr';
import type { BaseNodeFields } from './node';

export interface SerializedBaseNode {
  loc: SerializedSourceSpan;
}

export interface GlimmerParentNodeOptions extends BaseNodeFields {
  body: readonly ContentNode[];
}

export interface CallFields extends BaseNodeFields {
  callee: CalleeNode;
  args: Args;
}

export type CalleeNode = KeywordExpression | PathExpression | CallExpression;

export function isCalleeNode(node: ExpressionNode): node is CalleeNode {
  switch (node.type) {
    case 'Interpolate':
    case 'Literal':
      return false;
    default:
      return true;
  }
}

export type CallNode =
  | CallExpression
  | InvokeBlock
  | AppendContent
  | InvokeAngleBracketComponent
  | ElementModifier;
