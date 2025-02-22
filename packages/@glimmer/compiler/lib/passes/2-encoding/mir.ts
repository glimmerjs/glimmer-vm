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
  insertBefore: ExpressionValueNode | Missing;
  destination: ExpressionValueNode;
  block: NamedBlock;
}>() {}

/**
 * Used internally in the `unless` keywords.
 */
export class Not extends node('Not').fields<{ value: ExpressionValueNode }>() {}

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
  condition: ExpressionValueNode;
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
  value: ExpressionValueNode;
  key: ExpressionValueNode | null;
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
  positional: PresentPositional;
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
  named: PresentNamedArguments;
  block: NamedBlock;
}>() {}

/**
 * Syntax:
 *
 * - `(-get-dynamic-var <expr>)`
 * - `{{-get-dynamic-var <expr>}}`
 */
export class GetDynamicVar extends node('GetDynamicVar').fields<{
  name: ExpressionValueNode;
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
  definition: CalleeExpression | ASTv2.StringLiteral;
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
  html: ExpressionValueNode | ASTv2.ResolvedName | ASTv2.UnresolvedBinding;
}>() {}

/**
 * Syntax:
 *
 * - `{{<expr>}}` where `expr` is not a resolved or lexical reference.
 */
export class AppendValueCautiously extends node('AppendValueCautiously').fields<{
  value: ExpressionValueNode | ASTv2.ResolvedName | ASTv2.UnresolvedBinding;
}>() {}

export class AppendStaticContent extends node('AppendStaticContent').fields<{
  value: ASTv2.LiteralExpression;
}>() {}

export class AppendInvokableCautiously extends node('AppendInvokableCautiously').fields<{
  callee: ASTv2.ResolvedName | CalleeExpression;
  args: Args;
}>() {}

export class AppendTrustingInvokable extends node('AppendTrustingInvokable').fields<{
  callee: ASTv2.ResolvedName | CalleeExpression;
  args: Args;
}>() {}

export class AppendHtmlText extends node('AppendHtmlText').fields<{
  value: string;
}>() {}

export class AppendHtmlComment extends node('AppendHtmlComment').fields<{ value: SourceSlice }>() {}

export class Yield extends node('Yield').fields<{
  target: SourceSlice;
  to: number;
  positional: Positional;
}>() {}
export class Debugger extends node('Debugger').fields<{ scope: SymbolTable }>() {}

export class ResolvedAngleBracketComponent extends node('ResolvedAngleBracketComponent').fields<{
  tag: ASTv2.ResolvedName;
  params: ElementParameters;
  args: NamedArguments;
  blocks: NamedBlocks;
}>() {}

export class AngleBracketComponent extends node('AngleBracketComponent').fields<{
  tag: BlockCallee;
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
  value: AttrValueExpressionNode | ASTv2.ResolvedName; // interpolation is allowed here
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
  callee: ExpressionValueNode | ASTv2.UnresolvedBinding;
  args: Args;
}>() {}

/**
 * This represents a call whose head is not an in-scope name and also not a built-in Glimmer
 * keyword.
 *
 * In all modes, this can still be resolved downstream by a resolved keyword in the embedding
 * environment.
 *
 * In strict mode, it's an error if no runtime keyword is found. In classic mode, the the name is
 * then resolved as a helper using the runtime resolver.
 */
export class ResolvedCallExpression extends node('ResolvedCallExpression').fields<{
  callee: ASTv2.ResolvedName;
  args: Args;
}>() {}

export function isMirCalleeExpression(expr: AttrValueExpressionNode): expr is CalleeExpression {
  switch (expr.type) {
    case 'InterpolateExpression':
    case 'Literal':
      return false;
    default:
      return true;
  }
}

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
  condition: ExpressionValueNode;
  truthy: ExpressionValueNode;
  falsy: ExpressionValueNode | null;
}>() {}

export class ResolvedModifier extends node('ResolvedModifier').fields<{
  callee: ASTv2.ResolvedName;
  args: Args;
}>() {}
export class DynamicModifier extends node('DynamicModifier').fields<{
  callee: ExpressionValueNode;
  args: Args;
}>() {}
export class LexicalModifier extends node('LexicalModifier').fields<{
  callee: ASTv2.LexicalVarReference;
  args: Args;
}>() {}
export class InvokeBlockComponent extends node('InvokeBlockComponent').fields<{
  head: PathExpression | ASTv2.VariableReference;
  args: Args;
  blocks: NamedBlocks;
}>() {}
export class InvokeResolvedBlockComponent extends node('InvokeResolvedBlockComponent').fields<{
  head: ASTv2.ResolvedName;
  args: Args;
  blocks: NamedBlocks;
}>() {}
export class SplatAttr extends node('SplatAttr').fields<{ symbol: number }>() {}
export class PathExpression extends node('PathExpression').fields<{
  head: ASTv2.VariableReference | ASTv2.UnresolvedBinding;
  tail: Tail;
}>() {}

export class Missing extends node('Missing').fields() {}
export class InterpolateExpression extends node('InterpolateExpression').fields<{
  parts: PresentList<ExpressionValueNode>;
}>() {}
export class HasBlock extends node('HasBlock').fields<{ target: SourceSlice; symbol: number }>() {}
export class HasBlockParams extends node('HasBlockParams').fields<{
  target: SourceSlice;
  symbol: number;
}>() {}
export class Curry extends node('Curry').fields<{
  definition: ExpressionValueNode;
  curriedType: CurriedType;
  args: Args;
}>() {}
export class Positional extends node('Positional').fields<{
  list: OptionalList<ExpressionValueNode | ASTv2.UnresolvedBinding>;
}>() {
  isEmpty() {
    return !this.list.isPresent;
  }
}
export type PresentPositional = Positional & { list: PresentList<AttrValueExpressionNode> };
export class NamedArguments extends node('NamedArguments').fields<{
  entries: OptionalList<NamedArgument>;
}>() {
  isEmpty() {
    return !this.entries.isPresent;
  }
}
export type PresentNamedArguments = NamedArguments & { entries: PresentList<NamedArgument> };
export class NamedArgument extends node('NamedArgument').fields<{
  key: SourceSlice;
  value: AttrValueExpressionNode | ASTv2.UnresolvedBinding;
}>() {}
export class ComponentArgument extends node('ComponentArgument').fields<{
  key: SourceSlice;
  value: AttrValueExpressionNode; // interpolation is allowed here
}>() {}
export class Args extends node('Args').fields<{
  positional: Positional;
  named: NamedArguments;
}>() {
  isEmpty() {
    return this.positional.isEmpty() && this.named.isEmpty();
  }
}
export class Tail extends node('Tail').fields<{ members: PresentArray<SourceSlice> }>() {}

export class NamedBlocks extends node('NamedBlocks').fields<{
  blocks: OptionalList<NamedBlock>;
}>() {}

export class NamedBlock extends node('NamedBlock').fields<{
  scope: BlockSymbolTable;
  name: SourceSlice;
  body: Content[];
}>() {}

export type MaybeMissingExpressionNode = AttrValueExpressionNode | Missing;

export type BlockCallee = PathExpression | ASTv2.KeywordExpression | ASTv2.VariableReference;
export type CalleeExpression = BlockCallee | SomeCallExpression;

export type CustomExpression =
  | Not
  | IfExpression
  | HasBlock
  | HasBlockParams
  | Curry
  | Log
  | GetDynamicVar;

export type SomeCallExpression = CallExpression | ResolvedCallExpression | CustomExpression;

export type ExpressionValueNode = ASTv2.LiteralExpression | CalleeExpression;
export type AttrValueExpressionNode =
  | ASTv2.LiteralExpression
  | InterpolateExpression
  | CalleeExpression;

export type ElementParameter =
  | StaticAttr
  | DynamicAttr
  | DynamicModifier
  | ResolvedModifier
  | LexicalModifier
  | SplatAttr;

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
  | AppendHtmlText
  | AppendTrustedHTML
  | AppendStaticContent
  | AppendValueCautiously
  | AppendTrustingInvokable
  | AppendInvokableCautiously
  | AngleBracketComponent
  | ResolvedAngleBracketComponent
  | SimpleElement
  | InvokeBlockComponent
  | InvokeResolvedBlockComponent
  | AppendHtmlComment
  | IfContent
  | Each
  | Let
  | WithDynamicVars
  | InvokeComponentKeyword
  | InvokeResolvedComponentKeyword;

export function isCustomExpr(node: AttrValueExpressionNode): node is CustomExpression {
  switch (node.type) {
    case 'Not':
    case 'IfExpression':
    case 'HasBlock':
    case 'HasBlockParams':
    case 'Curry':
    case 'Log':
    case 'GetDynamicVar':
      node satisfies CustomExpression;
      return true;
    default:
      node satisfies Exclude<AttrValueExpressionNode, CustomExpression>;
      return false;
  }
}

export function isVariableReference(
  node: AttrValueExpressionNode
): node is ASTv2.VariableReference {
  switch (node.type) {
    case 'This':
    case 'Arg':
    case 'Local':
    case 'Lexical':
      node satisfies ASTv2.VariableReference;
      return true;
    default:
      node satisfies Exclude<AttrValueExpressionNode, ASTv2.VariableReference>;
      return false;
  }
}
