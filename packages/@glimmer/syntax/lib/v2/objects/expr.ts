import type { PresentArray } from '@glimmer/interfaces';
import { exhausted } from '@glimmer/debug-util';

import type * as ASTv1 from '../../v1/api';
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
  node: ExpressionValueNode | AttrValueNode,
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
  ref: VariableReference | ASTv2.UnresolvedBinding;
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
export class CallExpression extends node('Call').fields<CallFields>() {
  readonly isResolved = false;
}

export type CallSyntaxType =
  | 'component:callee'
  | 'modifier:callee'
  | 'block:callee'
  | 'append:value'
  | 'append:callee'
  | 'call:callee'
  | 'attr:callee'
  | 'arg:callee';

export type PathSyntaxType =
  | CallSyntaxType
  | 'interpolate:value'
  | 'attr:value'
  | 'component:arg'
  | 'arg:positional'
  | 'arg:named'
  | 'value:fixme';

export function describeUnresolvedItem(type: PathSyntaxType): string {
  switch (type) {
    case 'component:callee':
    case 'block:callee':
      return 'component';
    case 'modifier:callee':
      return 'modifier';
    case 'call:callee':
    case 'attr:callee':
    case 'arg:callee':
      return 'helper';
    case 'append:value':
      return 'content';
    case 'append:callee':
      return 'component or helper';
    case 'interpolate:value':
      return 'interpolated value';
    case 'attr:value':
      return 'attribute value';
    case 'component:arg':
      return 'component argument';
    case 'arg:positional':
      return 'positional argument';
    case 'arg:named':
      return 'named argument';
    case 'value:fixme':
      return 'value';
  }
}

export function describeUnresolvedError(type: PathSyntaxType, path: string, head?: string): string {
  const attempt = `\`${path}\``;
  const name = head && head !== path ? `\`${head}\`` : 'it';

  switch (type) {
    case 'component:callee':
      return `Attempted to resolve ${attempt} as a component, but ${name} was not in scope`;
    case 'modifier:callee':
      return `Attempted to resolve ${attempt} as a modifier, but ${name} was not in scope`;
    case 'block:callee':
      return `Attempted to resolve ${attempt} as a TODO, but ${name} was not in scope`;
    case 'append:value':
      return `Attempted to append ${attempt}, but ${name} was not in scope`;
    case 'append:callee':
      return `Attempted to call ${attempt} as a component or helper, but ${name} was not in scope`;
    case 'call:callee':
      return `Attempted to call ${attempt} as a helper, but ${name} was not in scope`;
    case 'attr:callee':
      return `Attempted to call a helper ${attempt} as an attribute value, but ${name} was not in scope`;
    case 'arg:callee':
      return `Attempted to call a helper ${attempt} as an argument, but ${name} was not in scope`;
    case 'interpolate:value':
      return `Attempted to interpolate ${attempt} as an attribute value, but ${name} was not in scope`;
    case 'attr:value':
      return `Attempted to set ${attempt} as an attribute value, but ${name} was not in scope`;
    case 'component:arg':
      return `Attempted to pass ${attempt} as an argument to a component, but ${name} was not in scope`;
    case 'arg:positional':
      return `Attempted to pass ${attempt} as a positional argument, but ${name} was not in scope`;
    case 'arg:named':
      return `Attempted to pass ${attempt} as a named argument, but ${name} was not in scope`;
    case 'value:fixme':
      return `Attempted to use ${attempt} as a value, but ${name} was not in scope`;
    default:
      return exhausted(type);
  }
}

export type CallSyntaxKind = 'callee' | 'value';
export type CallSyntaxName = 'name' | 'path';

export type CallSyntax = `${CallSyntaxType}:${CallSyntaxKind}:${CallSyntaxName}`;

export function parseCallSyntax(callSyntax: CallSyntax): {
  type: CallSyntaxType;
  kind: CallSyntaxKind;
  name: CallSyntaxName;
} {
  const [type, kind, name] = callSyntax.split(':') as [
    CallSyntaxType,
    CallSyntaxKind,
    CallSyntaxName,
  ];
  return { type, kind, name };
}

export function callSyntaxFor(
  type: CallSyntaxType,
  { path, params, hash }: { path: ASTv1.Expression; params?: ASTv1.Expression[]; hash?: ASTv1.Hash }
): CallSyntax {
  const kind =
    (params && params.length > 0) || (hash && hash.pairs.length > 0) ? 'callee' : 'value';
  const name = path.type === 'PathExpression' && path.tail.length > 0 ? 'path' : 'name';
  return `${type}:${kind}:${name}`;
}

export class ResolvedCallExpression extends node('ResolvedCall').fields<{
  resolved: ASTv2.ResolvedName | ASTv2.UnresolvedBinding;
  args: ASTv2.CurlyArgs;
}>() {
  readonly isResolved = true;
}

/**
 * Corresponds to an interpolation in attribute value position.
 *
 * ```hbs
 * <a href="{{url}}.html"
 * ```
 */
export class InterpolateExpression extends node('Interpolate').fields<{
  parts: PresentArray<InterpolatePartNode>;
}>() {}

export class CurlyAttrValue extends node('CurlyAttrValue').fields<{
  value: ExpressionValueNode;
}>() {}

export class CurlyResolvedAttrValue extends node('CurlyResolvedAttrValue').fields<{
  resolved: ASTv2.ResolvedName | ASTv2.UnresolvedBinding;
}>() {
  readonly isResolved = true;
}

export class CurlyInvokeResolvedAttr extends node('CurlyInvokeResolvedAttr').fields<{
  resolved: ASTv2.ResolvedName | ASTv2.UnresolvedBinding;
  args: ASTv2.CurlyArgs;
}>() {
  readonly isResolved = true;
}

export class CurlyInvokeAttr extends node('CurlyInvokeAttr').fields<CallFields>() {}

export type InterpolatePartNode =
  | CurlyAttrValue
  | CurlyResolvedAttrValue
  | CurlyInvokeAttr
  | CurlyInvokeResolvedAttr
  | StringLiteral;

export type AttrValueNode = InterpolatePartNode | InterpolateExpression;

export type ExpressionValueNode =
  | LiteralExpression
  | PathExpression
  | VariableReference
  | KeywordExpression
  | CallExpression
  | ResolvedCallExpression
  | ASTv1.ErrorNode;
export type AppendValueNode = ASTv2.DynamicCallee | KeywordExpression | ASTv2.LiteralExpression;
