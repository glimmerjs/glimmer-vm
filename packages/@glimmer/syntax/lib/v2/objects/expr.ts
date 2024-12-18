import type { CallFields } from './base';
import type { NodeConstructor } from './node';
import type { VariableReference } from './refs';

import { SourceSlice } from '../../source/slice';
import { AstNode } from './node';

/**
 * A Handlebars literal.
 *
 * {@link https://handlebarsjs.com/guide/expressions.html#literal-segments}
 */
export type LiteralValue = string | boolean | number | undefined | null;

export interface LiteralTypes {
  string: string;
  boolean: boolean;
  number: number;
  null: null;
  undefined: undefined;
}

/**
 * Corresponds to a Handlebars literal.
 *
 * @see {LiteralValue}
 */
export const LiteralExpressionFields: NodeConstructor<'Literal', { value: LiteralValue }> =
  AstNode('Literal');

export class LiteralExpression extends LiteralExpressionFields {
  toSlice(this: StringLiteral): SourceSlice {
    return new SourceSlice({ loc: this.loc, chars: this.value });
  }
}

export type StringLiteral = LiteralExpression & { value: string };

/**
 * Returns true if an input {@see ExpressionNode} is a literal.
 */
export function isLiteral<K extends keyof LiteralTypes = keyof LiteralTypes>(
  node: ExpressionNode,
  kind?: K
): node is StringLiteral {
  if (node.type === 'Literal') {
    if (kind === undefined) {
      return true;
    } else if (kind === 'null') {
      return node.value === null;
    } else {
      return typeof node.value === kind;
    }
  } else {
    return false;
  }
}

/**
 * Corresponds to a path in expression position.
 *
 * ```hbs
 * this
 * this.x
 * @x
 * @x.y
 * x
 * x.y
 * ```
 */
export const PathExpressionFields: NodeConstructor<
  'Path',
  {
    ref: VariableReference;
    tail: readonly SourceSlice[];
  }
> = AstNode('Path');
export class PathExpression extends PathExpressionFields {}

/**
 * Corresponds to a known strict-mode keyword. It behaves similarly to a
 * PathExpression with a FreeVarReference, but implies StrictResolution and
 * is guaranteed to not have a tail, since `{{outlet.foo}}` would have been
 * illegal.
 */
export const KeywordExpressionFields: NodeConstructor<'Keyword', { name: string; symbol: number }> =
  AstNode('Keyword');
export class KeywordExpression extends KeywordExpressionFields {}

/**
 * Corresponds to a parenthesized call expression.
 *
 * ```hbs
 * (x)
 * (x.y)
 * (x y)
 * (x.y z)
 * ```
 */
const CallExpressionFields: NodeConstructor<'Call', CallFields> = AstNode('Call');

export class CallExpression extends CallExpressionFields {}

/**
 * Corresponds to an interpolation in attribute value position.
 *
 * ```hbs
 * <a href="{{url}}.html"
 * ```
 */
export const InterpolateExpressionFields: NodeConstructor<
  'Interpolate',
  { parts: readonly ExpressionNode[] }
> = AstNode('Interpolate');

export class InterpolateExpression extends InterpolateExpressionFields {}

export type ExpressionNode =
  | LiteralExpression
  | PathExpression
  | KeywordExpression
  | CallExpression
  | InterpolateExpression;
