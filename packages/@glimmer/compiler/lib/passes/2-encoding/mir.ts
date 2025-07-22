import type { CurriedType, Optional, PresentArray } from '@glimmer/interfaces';
import type {
  ASTv1,
  ASTv2,
  BlockSymbolTable,
  ProgramSymbolTable,
  SourceSlice,
  SourceSpan,
  SymbolTable,
} from '@glimmer/syntax';
import { CURRIED_COMPONENT, CURRIED_HELPER, CURRIED_MODIFIER } from '@glimmer/constants';
import { node } from '@glimmer/syntax';

import type { AnyOptionalList, OptionalList, PresentList } from '../../shared/list';

/**
 * Represents the root of a parsed template.
 */
export class Template extends node('Template').fields<{
  scope: ProgramSymbolTable;
  body: Content[];
}>() {}

export class CustomNamedArgument<T> {
  static from<T>(arg: ASTv2.CurlyArgument, value: T): CustomNamedArgument<T> {
    return new CustomNamedArgument({ loc: arg.loc, name: arg.name, value });
  }

  readonly type = 'CustomNamedArgument';
  readonly loc: SourceSpan;
  readonly name: SourceSlice;
  readonly value: T;

  constructor(fields: { loc: SourceSpan; name: SourceSlice; value: T }) {
    this.loc = fields.loc;
    this.name = fields.name;
    this.value = fields.value;
  }
}

/**
 * Syntax: `{{#in-element ...}} ... {{/in-element}}`
 */
export class InElement extends node('InElement').fields<{
  keyword: SourceSlice;
  guid: string;
  insertBefore: CustomNamedArgument<ExpressionValueNode> | Missing;
  destination: ExpressionValueNode;
  block: NamedBlock;
}>() {}

/**
 * Used internally in the `unless` keywords.
 */
export class Not extends node('Not').fields<{
  keyword: SourceSlice;
  value: ExpressionValueNode;
}>() {
  readonly syntax = 'not';
}

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
  keyword: SourceSlice;
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
  keyword: SourceSlice;
  value: ExpressionValueNode;
  key: CustomNamedArgument<ExpressionValueNode> | null;
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
  keyword: SourceSlice;
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
  keyword: SourceSlice;
  named: PresentCurlyNamedArguments;
  block: NamedBlock;
}>() {}

/**
 * Syntax:
 *
 * - `(-get-dynamic-var <expr>)`
 * - `{{-get-dynamic-var <expr>}}`
 */
export class GetDynamicVar extends node('GetDynamicVar').fields<{
  keyword: SourceSlice;
  name: ExpressionValueNode;
}>() {
  readonly syntax = '-get-dynamic-var';
}

/**
 * Syntax:
 *
 * - `{{log ...}}`
 * - `(log ...)`
 */
export class Log extends node('Log').fields<{
  keyword: SourceSlice;
  positional: Positional;
}>() {
  readonly syntax = 'log';
}

/**
 * Syntax:
 *
 * - `{{component <expr>}}`
 * - `{{#component <expr>}}`
 */
export class InvokeComponentKeyword extends node('InvokeComponentKeyword').fields<{
  keyword: SourceSlice;
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
  keyword: SourceSlice;
  definition: string;
  args: Args;
  blocks?: Optional<NamedBlocks>;
}>() {}

export class AppendTrustedHTML extends node('AppendTrustedHTML').fields<{
  value: ExpressionValueNode | ASTv2.ResolvedName | ASTv2.UnresolvedBinding;
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
  callee: ASTv2.ResolvedName | ASTv2.UnresolvedBinding | CalleeExpression;
  args: Args;
}>() {}

export class AppendTrustingInvokable extends node('AppendTrustingInvokable').fields<{
  callee: ASTv2.ResolvedName | ASTv2.UnresolvedBinding | CalleeExpression;
  args: Args;
}>() {}

export class AppendHtmlText extends node('AppendHtmlText').fields<{
  value: string;
}>() {}

export class AppendHtmlComment extends node('AppendHtmlComment').fields<{ value: SourceSlice }>() {}

export class Yield extends node('Yield').fields<{
  keyword: SourceSlice;
  target: SourceSlice;
  to: number;
  positional: Positional;
}>() {}
export class Debugger extends node('Debugger').fields<{
  keyword: SourceSlice;
  scope: SymbolTable;
}>() {}

export class ResolvedAngleBracketComponent extends node('ResolvedAngleBracketComponent').fields<{
  tag: ASTv2.ResolvedName;
  params: ElementParameters;
  args: ComponentArguments;
  blocks: NamedBlocks;
  error?: Optional<ASTv1.ErrorNode>;
}>() {}

export class AngleBracketComponent extends node('AngleBracketComponent').fields<{
  tag: BlockCallee;
  params: ElementParameters;
  args: ComponentArguments;
  blocks: NamedBlocks;
  error?: Optional<ASTv1.ErrorNode>;
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
  value: AttrStyleInterpolatePart | InterpolateExpression; // interpolation is allowed here
  namespace?: string | undefined;
}>() {}

export class SimpleElement extends node('SimpleElement').fields<{
  tag: SourceSlice;
  params: ElementParameters;
  body: Content[];
  dynamicFeatures: boolean;
  error?: Optional<ASTv1.ErrorNode>;
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
  callee: ASTv2.ResolvedName | ASTv2.UnresolvedBinding;
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
  keyword: SourceSlice;
  condition: ExpressionValueNode;
  truthy: ExpressionValueNode;
  falsy: ExpressionValueNode | null;
}>() {
  readonly syntax = 'if';
}

export class ResolvedModifier extends node('ResolvedModifier').fields<{
  callee: ASTv2.ResolvedName;
  args: Args;
}>() {}
export class DynamicModifier extends node('DynamicModifier').fields<{
  callee: ExpressionValueNode | ASTv2.UnresolvedBinding;
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
  parts: PresentList<AttrStyleInterpolatePart>;
}>() {}
export class HasBlock extends node('HasBlock').fields<{
  keyword: SourceSlice;
  target: SourceSlice;
  symbol: number;
}>() {
  readonly syntax = 'has-block';
}
export class HasBlockParams extends node('HasBlockParams').fields<{
  keyword: SourceSlice;
  target: SourceSlice;
  symbol: number;
}>() {
  readonly syntax = 'has-block-params';
}
export class Curry extends node('Curry').fields<{
  keyword: SourceSlice;
  definition: ExpressionValueNode;
  curriedType: CurriedType;
  args: Args;
}>() {
  get syntax() {
    switch (this.curriedType) {
      case CURRIED_COMPONENT:
        return 'component';
      case CURRIED_HELPER:
        return 'helper';
      case CURRIED_MODIFIER:
        return 'modifier';
    }
  }
}
export class Positional extends node('Positional').fields<{
  list: OptionalList<ExpressionValueNode | ASTv2.UnresolvedBinding>;
}>() {
  isEmpty() {
    return !this.list.isPresent;
  }
}
export type PresentPositional = Positional & { list: PresentList<ExpressionValueNode> };
export class CurlyNamedArguments extends node('NamedArguments').fields<{
  entries: OptionalList<CurlyNamedArgument>;
}>() {
  isEmpty() {
    return !this.entries.isPresent;
  }
}

export class ComponentArguments extends node('ComponentArguments').fields<{
  entries: OptionalList<ComponentArgument>;
}>() {
  isEmpty() {
    return !this.entries.isPresent;
  }
}

/**
 * Captures the `{{}}` wrapping span of an attribute value expression.
 */
export type CoreAttrStyleInterpolatePart =
  | CurlyAttrValue
  | ASTv2.CurlyResolvedAttrValue
  | CurlyInvokeAttr
  | CurlyInvokeResolvedAttr
  | ASTv2.StringLiteral;

export type AttrStyleInterpolatePart = CoreAttrStyleInterpolatePart | CustomInterpolationPart;

export class CustomInterpolationPart extends node('mir.CustomInterpolationPart').fields<{
  value: CustomExpression;
}>() {}

export type AttrStyleValue = AttrStyleInterpolatePart | InterpolateExpression;

export class CurlyAttrValue extends node('mir.CurlyAttrValue').fields<{
  value: ExpressionValueNode | ASTv2.UnresolvedBinding;
}>() {}

export class CurlyInvokeAttr extends node('mir.CurlyInvokeAttr').fields<{
  callee: ExpressionValueNode | ASTv2.UnresolvedBinding;
  args: Args;
}>() {}

export class CurlyInvokeResolvedAttr extends node('mir.CurlyInvokeResolvedAttr').fields<{
  resolved: ASTv2.ResolvedName | ASTv2.UnresolvedBinding;
  args: Args;
}>() {}

export type PresentCurlyNamedArguments = CurlyNamedArguments & {
  entries: PresentList<CurlyNamedArgument>;
};
export class CurlyNamedArgument extends node('NamedArgument').fields<{
  name: SourceSlice;
  value: ExpressionValueNode | ASTv2.UnresolvedBinding;
}>() {}

export type PresentComponentArguments = ComponentArguments & {
  entries: PresentList<ComponentArgument>;
};
export class ComponentArgument extends node('ComponentArgument').fields<{
  name: SourceSlice;
  value: ComponentArgumentValue;
}>() {}

export type ComponentArgumentValue = AttrStyleInterpolatePart | InterpolateExpression;

export class Args extends node('Args').fields<{
  positional: Positional;
  named: CurlyNamedArguments;
}>() {
  isEmpty() {
    return this.positional.isEmpty() && this.named.isEmpty();
  }
}
export class Tail extends node('Tail').fields<{ members: PresentArray<SourceSlice> }>() {}

export class NamedBlocks extends node('NamedBlocks').fields<{
  blocks: OptionalList<NamedBlock | ASTv1.ErrorNode>;
}>() {}

export class NamedBlock extends node('NamedBlock').fields<{
  scope: BlockSymbolTable;
  name: SourceSlice;
  body: Content[];
  error?: Optional<ASTv1.ErrorNode>;
}>() {}

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
export type ExpressionNode = ExpressionValueNode | CustomNamedArgument<ExpressionValueNode>;

// MirNode type represents all possible MIR node types
// Note: This is kept for completeness but currently not used after moving to shared PostValidationView
// type MirNode = ExpressionNode | Content | Internal | ASTv2.ResolvedName;

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
  | CurlyNamedArguments
  | CurlyNamedArgument
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

export function isCustomExpr(node: CalleeExpression): node is CustomExpression {
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
      node satisfies Exclude<CalleeExpression, CustomExpression>;
      return false;
  }
}

export function isVariableReference(node: ExpressionValueNode): node is ASTv2.VariableReference {
  switch (node.type) {
    case 'This':
    case 'Arg':
    case 'Local':
    case 'Lexical':
      node satisfies ASTv2.VariableReference;
      return true;
    default:
      node satisfies Exclude<ExpressionValueNode, ASTv2.VariableReference>;
      return false;
  }
}
