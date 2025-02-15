import type { PresentArray } from '@glimmer/interfaces';

import type * as ASTv2 from '../api';
import type { CallFields } from './base';
import type { VariableReference } from './refs';

import { SourceSlice } from '../../source/slice';
import { node } from './node';

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
export class LiteralExpression extends node('Literal').fields<{ value: LiteralValue }>() {
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
 *
 * ## Note
 *
 * An expression is **not** an `ASTv2.PathExpression` if it is a bare identifier and that identifier
 * is not in scope or a known keyword.
 *
 * In strict mode, all identifiers resolve to {@linkcode PathExpressions} or syntax errors if they
 * refer to variables that are not in scope.
 *
 * In classic mode, they
 * may also resolve to {@linkcode ResolvedAppendable}s, {@linkcode ResolvedHelperCallee},
 * {@linkcode ResolvedModifierCallee} or {@linkcode ResolvedComponentCallee}s.
 *
 * ### `ResolvedAppendable`
 *
 * ```hbs
 * {{hello @world}}
 * ```
 *
 * In this example, `hello` is not an `ASTv2.PathExpression`, since it is not in scope. Instead, it
 * is represented as a {@linkcode ResolvedAppendable}, since it may either be a component or helper,
 * depending on the value of `hello` resolved at runtime.
 *
 * ### `ResolvedHelperCallee`
 *
 * In this example:
 *
 * ```hbs
 * {{#let (helper 'hello') as |hello|}}
 *   {{hello (world)}}
 * {{/let}}
 * ```
 *
 * - `hello` is a `PathExpression`, since it is an in-scope variable.
 * - `world` is a `ResolvedHelperCallee`, since the `()` syntax only allows free references to
 *   resolve to a helper.
 *
 * ### `PathExpression`
 *
 * Finally, in this example:
 *
 * ```hbs
 * {{#let @hello as |hello|}}
 *   {{hello @world}}
 *
 *   {{#let hello as |h|}}
 *      {{h @world}}
 *   {{/let}}
 * {{/let}}
 * </template>
 * ```
 *
 * Both `hello` and `h` are represented as `PathExpression`s, since they are in-scope variables.
 */
export class PathExpression extends node('Path').fields<{
  ref: VariableReference;
  tail: readonly SourceSlice[];
}>() {}

/**
 * Corresponds to a known strict-mode keyword. It behaves similarly to a
 * PathExpression with a FreeVarReference, but implies StrictResolution and
 * is guaranteed to not have a tail, since `{{outlet.foo}}` would have been
 * illegal.
 */
export class KeywordExpression extends node('Keyword').fields<{
  name: string;
  symbol: number;
}>() {}

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
export class CallExpression extends node('Call').fields<CallFields>() {}

/**
 * Corresponds to an interpolation in attribute value position.
 *
 * ```hbs
 * <a href="{{url}}.html"
 * ```
 */
export class InterpolateExpression extends node('Interpolate').fields<{
  parts: PresentArray<ExpressionNode>;
}>() {}

export type ExpressionNode = ExpressionValueNode | InterpolateExpression;

export type ExpressionValueNode =
  | LiteralExpression
  | PathExpression
  | KeywordExpression
  | CallExpression;
export type AppendValueNode = ASTv2.DynamicCallee | KeywordExpression | ASTv2.LiteralExpression;
