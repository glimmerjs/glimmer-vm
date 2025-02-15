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
import type { ResolvedHelperCallee } from './refs';

export interface SerializedBaseNode {
  loc: SerializedSourceSpan;
}

export interface GlimmerParentNodeOptions extends BaseNodeFields {
  body: readonly ContentNode[];
}

export interface CallFields extends BaseNodeFields {
  callee: DynamicCallee | ResolvedHelperCallee | KeywordExpression;
  args: Args;
}

export type DynamicCallee = KeywordExpression | PathExpression | CallExpression;

export function isDynamicCallee(node: ExpressionNode): node is DynamicCallee {
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
