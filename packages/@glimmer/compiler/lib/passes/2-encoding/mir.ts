import type { CurriedType, Optional, PresentArray } from '@glimmer/interfaces';
import type {
  ASTv2,
  BlockSymbolTable,
  ProgramSymbolTable,
  SourceSlice,
  SymbolTable,
} from '@glimmer/syntax';
import { node } from '@glimmer/syntax';

import type { AnyOptionalList, OptionalList, PresentList } from '../../shared/list';

/**
 * Represents the root of a parsed template.
 */
export class Template extends node('Template').fields<{
  scope: ProgramSymbolTable;
  body: Content[];
}>() {}

/**
 * Syntax: `{{#in-element ...}} ... {{/in-element}}`
 */
export class InElement extends node('InElement').fields<{
  guid: string;
  insertBefore: ExpressionNode | Missing;
  destination: ExpressionNode;
  block: NamedBlock;
}>() {}

/**
 * Used internally in the `unless` keywords.
 */
export class Not extends node('Not').fields<{ value: ExpressionNode }>() {}

/**
 * Syntaxes
 *
 * - `{{#if ...}} ... {{/if}}`
 * - `{{#unless ...}} ... {{/unless}}`
 *
 * The `unless` keyword is implemented as a special case of the `if` keyword:
 *
 * ```hbs
 * {{#unless condition}}
 *   ...
 * {{/unless}}
 * ```
 *
 * is compiled into:
 *
 * ```hbs
 * {{#if (%not condition)}}
 *   ...
 * {{/if}}
 * ```
 *
 * where `%not` is the above {@linkcode Not} node.
 */
export class IfContent extends node('IfContent').fields<{
  condition: ExpressionNode;
  block: NamedBlock;
  inverse: NamedBlock | null;
}>() {}

/**
 * Syntax:
 *
 * ```hbs
 * {{#each <expr> key=<expr> as |y|}}
 *   ...
 * {{/each}}
 * ```
 */
export class Each extends node('Each').fields<{
  value: ExpressionNode;
  key: ExpressionNode | null;
  block: NamedBlock;
  inverse: NamedBlock | null;
}>() {}

/**
 * Syntax:
 *
 * ```hbs
 * {{#let <expr> as |y|}}
 *   ...
 * {{/let}}
 * ```
 */
export class Let extends node('Let').fields<{
  positional: Positional;
  block: NamedBlock;
}>() {}

/**
 * Syntax:
 *
 * ```hbs
 * {{#-with-dynamic-vars <expr>}}
 *   ...
 * {{/with}}
 * ```
 */
export class WithDynamicVars extends node('WithDynamicVars').fields<{
  named: NamedArguments;
  block: NamedBlock;
}>() {}

/**
 * Syntax:
 *
 * - `(-get-dynamic-var <expr>)`
 * - `{{-get-dynamic-var <expr>}}`
 */
export class GetDynamicVar extends node('GetDynamicVar').fields<{
  name: ExpressionNode;
}>() {}

/**
 * Syntax:
 *
 * - `{{log ...}}`
 * - `(log ...)`
 */
export class Log extends node('Log').fields<{
  positional: Positional;
}>() {}

/**
 * Syntax:
 *
 * - `{{component <expr>}}`
 * - `{{#component <expr>}}`
 */
export class InvokeComponentKeyword extends node('InvokeComponentKeyword').fields<{
  definition: Exclude<ExpressionNode, ASTv2.LiteralExpression>;
  args: Args;
  blocks?: Optional<NamedBlocks>;
}>() {}

/**
 * Syntax:
 *
 * - `{{component "name-to-resolve"}}`
 * - `{{#component "name-to-resolve"}}`
 */
export class InvokeResolvedComponentKeyword extends node('InvokeResolvedComponentKeyword').fields<{
  definition: string;
  args: Args;
  blocks?: Optional<NamedBlocks>;
}>() {}

export class AppendTrustedHTML extends node('AppendTrustedHTML').fields<{
  html: ExpressionNode;
}>() {}

/**
 * Syntax:
 *
 * - `{{<expr>}}` where `expr` is not a resolved or lexical reference.
 */
export class AppendValue extends node('AppendValue').fields<{ value: ExpressionNode }>() {}
export class AppendHtmlComment extends node('AppendHtmlComment').fields<{ value: SourceSlice }>() {}

export class Yield extends node('Yield').fields<{
  target: SourceSlice;
  to: number;
  positional: Positional;
}>() {}
export class Debugger extends node('Debugger').fields<{ scope: SymbolTable }>() {}

export class AngleBracketComponent extends node('AngleBracketComponent').fields<{
  tag: ExpressionNode;
  params: ElementParameters;
  args: NamedArguments;
  blocks: NamedBlocks;
}>() {}

export interface AttrKind {
  // triple-curly
  trusting: boolean;
  // this attribute is on an element with component features:
  //   - <CapCase ...>
  //   - modifiers
  //   - <dynamic.tag ...>
  component: boolean;
}

export class StaticAttr extends node('StaticAttr').fields<{
  kind: { component: boolean };
  name: SourceSlice;
  value: SourceSlice;
  namespace?: string | undefined;
}>() {}

export class DynamicAttr extends node('DynamicAttr').fields<{
  kind: AttrKind;
  name: SourceSlice;
  value: ExpressionNode;
  namespace?: string | undefined;
}>() {}

export class SimpleElement extends node('SimpleElement').fields<{
  tag: SourceSlice;
  params: ElementParameters;
  body: Content[];
  dynamicFeatures: boolean;
}>() {}

export class ElementParameters extends node('ElementParameters').fields<{
  body: AnyOptionalList<ElementParameter>;
}>() {}

export class CallExpression extends node('CallExpression').fields<{
  callee: ExpressionNode;
  args: Args;
}>() {}

/**
 * Syntax: `(if ...)`
 *
 * The expression form of `unless` is implemented similarly to the block form:
 *
 * ```hbs
 * {{#let (unless x y z) as |z|}}
 *   ...
 * {{/let}}
 * ```
 *
 * is compiled into:
 *
 * ```hbs
 * {{#let (if (%not x) y z) as |z|}}
 *   ...
 * {{/let}}
 * ```
 */
export class IfExpression extends node('IfExpression').fields<{
  condition: ExpressionNode;
  truthy: ExpressionNode;
  falsy: ExpressionNode | null;
}>() {}

export class Modifier extends node('Modifier').fields<{ callee: ExpressionNode; args: Args }>() {}
export class InvokeBlockComponent extends node('InvokeBlockComponent').fields<{
  head: PathExpression | ASTv2.VariableReference;
  args: Args;
  blocks: NamedBlocks;
}>() {}
export class SplatAttr extends node('SplatAttr').fields<{ symbol: number }>() {}
export class PathExpression extends node('PathExpression').fields<{
  head: ExpressionNode;
  tail: Tail;
}>() {}

export class Missing extends node('Missing').fields() {}
export class InterpolateExpression extends node('InterpolateExpression').fields<{
  parts: PresentList<ExpressionNode>;
}>() {}
export class HasBlock extends node('HasBlock').fields<{ target: SourceSlice; symbol: number }>() {}
export class HasBlockParams extends node('HasBlockParams').fields<{
  target: SourceSlice;
  symbol: number;
}>() {}
export class Curry extends node('Curry').fields<{
  definition: ExpressionNode;
  curriedType: CurriedType;
  args: Args;
}>() {}
export class Positional extends node('Positional').fields<{
  list: OptionalList<ExpressionNode>;
}>() {}
export class NamedArguments extends node('NamedArguments').fields<{
  entries: OptionalList<NamedArgument>;
}>() {}
export class NamedArgument extends node('NamedArgument').fields<{
  key: SourceSlice;
  value: ExpressionNode;
}>() {}
export class Args extends node('Args').fields<{
  positional: Positional;
  named: NamedArguments;
}>() {}
export class Tail extends node('Tail').fields<{ members: PresentArray<SourceSlice> }>() {}

export class NamedBlocks extends node('NamedBlocks').fields<{
  blocks: OptionalList<NamedBlock>;
}>() {}

export class NamedBlock extends node('NamedBlock').fields<{
  scope: BlockSymbolTable;
  name: SourceSlice;
  body: Content[];
}>() {}

export type MaybeMissingExpressionNode = ExpressionNode | Missing;

export type ExpressionNode =
  | ASTv2.LiteralExpression
  | ASTv2.KeywordExpression
  | ASTv2.VariableReference
  | PathExpression
  | InterpolateExpression
  | CallExpression
  | Not
  | IfExpression
  | HasBlock
  | HasBlockParams
  | Curry
  | GetDynamicVar
  | Log;

export type ElementParameter = StaticAttr | DynamicAttr | Modifier | SplatAttr;

export type Internal =
  | Args
  | Positional
  | NamedArguments
  | NamedArgument
  | Tail
  | NamedBlock
  | NamedBlocks
  | ElementParameters;

export type Content =
  | InElement
  | Debugger
  | Yield
  | AppendTrustedHTML
  | AppendValue
  | AngleBracketComponent
  | SimpleElement
  | InvokeBlockComponent
  | AppendHtmlComment
  | IfContent
  | Each
  | Let
  | WithDynamicVars
  | InvokeComponentKeyword
  | InvokeResolvedComponentKeyword;
