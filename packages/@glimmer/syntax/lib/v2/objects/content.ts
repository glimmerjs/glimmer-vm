import type { Optional } from '@glimmer/interfaces';

import type { SourceSlice } from '../../source/slice';
import type { SourceSpan } from '../../source/span';
import type { SymbolTable } from '../../symbol-table';
import type * as ASTv1 from '../../v1/api';
import type { ComponentArgs, CurlyArgs, ResolvedName, UnresolvedBinding } from './args';
import type {
  ComponentArg,
  ElementModifier,
  HtmlOrSplatAttr,
  ResolvedElementModifier,
  SomeElementModifier,
} from './attr-block';
import type { DynamicCallee } from './base';
import type { KeywordExpression, LiteralExpression, PathExpression } from './expr';
import type { NamedBlock, NamedBlocks } from './internal-node';
import type { BaseNodeFields } from './node';
import type { VariableReference } from './refs';

import { SpanList } from '../../source/span-list';
import { ComponentNamedArguments, EmptyComponentArgs } from './args';
import { node } from './node';

/**
 * Content Nodes are allowed in content positions in templates. They correspond to behavior in the
 * [Data][data] tokenization state in HTML.
 *
 * [data]: https://html.spec.whatwg.org/multipage/parsing.html#data-state
 */
export type ContentNode =
  | HtmlText
  | HtmlComment
  | AppendContent
  | AppendResolvedContent
  | AppendStaticContent
  | AppendResolvedInvokable
  | AppendInvokable
  | InvokeBlock
  | InvokeResolvedBlock
  | InvokeAngleBracketComponent
  | InvokeResolvedAngleBracketComponent
  | SimpleElementNode
  | GlimmerComment
  | ASTv1.ErrorNode;

export class GlimmerComment extends node('GlimmerComment').fields<{ text: SourceSlice }>() {}
export class HtmlText extends node('HtmlText').fields<{ chars: string }>() {}
export class HtmlComment extends node('HtmlComment').fields<{ text: SourceSlice }>() {}

export class AppendStaticContent extends node('AppendStaticContent').fields<{
  value: LiteralExpression;
}>() {}

export class AppendResolvedInvokable extends node('AppendResolvedInvokable').fields<{
  resolved: ResolvedName | UnresolvedBinding;
  trusting: boolean;
  args: CurlyArgs;
}>() {
  readonly isResolved = true;
}

export class AppendInvokable extends node('AppendInvokable').fields<{
  callee: DynamicCallee;
  trusting: boolean;
  args: CurlyArgs;
}>() {
  readonly isResolved = false;
}

export class AppendResolvedContent extends node('AppendResolvedContent').fields<{
  resolved: ResolvedName | UnresolvedBinding;
  trusting: boolean;
}>() {
  readonly isResolved = true;
}

export class AppendContent extends node('AppendContent').fields<{
  value: DynamicCallee | UnresolvedBinding;
  trusting: boolean;
  table: SymbolTable;
}>() {
  readonly isResolved = false;
}

export type BlockCallee =
  | KeywordExpression
  | PathExpression
  | VariableReference
  | ASTv1.ErrorNode
  | UnresolvedBinding;

export class InvokeBlock extends node('InvokeBlock').fields<{
  callee: BlockCallee;
  args: CurlyArgs;
  blocks: NamedBlocks;
}>() {
  get isResolved(): boolean {
    return this.callee.type === 'UnresolvedBinding';
  }

  get resolved(): Optional<ResolvedName | UnresolvedBinding> {
    if (this.callee.type === 'UnresolvedBinding') {
      return this.callee;
    }
  }
}

export class InvokeResolvedBlock extends node('InvokeResolvedBlock').fields<{
  resolved: ResolvedName;
  args: CurlyArgs;
  blocks: NamedBlocks;
}>() {
  readonly isResolved = true;
}

export type InvokeSomeBlock = InvokeBlock | InvokeResolvedBlock;

interface BaseInvokeComponentFields {
  blocks: NamedBlocks;
  attrs: readonly HtmlOrSplatAttr[];
  componentArgs: readonly ComponentArg[];
  modifiers: readonly SomeElementModifier[];
  error?: Optional<ASTv1.ErrorNode>;
}

interface InvokeComponentFields extends BaseInvokeComponentFields {
  callee: PathExpression;
}

interface InvokeResolvedComponentFields extends BaseInvokeComponentFields {
  callee: ResolvedName;
}

/**
 * Corresponds to a component invocation. When the content of a component invocation contains no
 * named blocks, `blocks` contains a single named block named `"default"`. When a component
 * invocation is self-closing, `blocks` is empty.
 */
export class InvokeAngleBracketComponent extends node(
  'InvokeAngleBracketComponent'
).fields<InvokeComponentFields>() {
  get args(): ComponentArgs {
    return getComponentArgs(this.componentArgs, this.callee.loc);
  }
}

export class InvokeResolvedAngleBracketComponent extends node(
  'InvokeResolvedAngleBracketComponent'
).fields<InvokeResolvedComponentFields>() {
  get args(): ComponentArgs {
    return getComponentArgs(this.componentArgs, this.callee.loc);
  }
}

export type InvokeSomeAngleBracketComponent =
  | InvokeAngleBracketComponent
  | InvokeResolvedAngleBracketComponent;

function getComponentArgs(
  componentArgs: readonly ComponentArg[],
  calleeSpan: SourceSpan
): ComponentArgs {
  let entries = componentArgs as ComponentArg[]; // cast to non-readonly

  return EmptyComponentArgs(
    ComponentNamedArguments(SpanList.range(entries, calleeSpan.collapse('end')), entries)
  );
}

interface SimpleElementOptions extends BaseNodeFields {
  tag: SourceSlice;
  body: readonly ContentNode[];
  attrs: readonly HtmlOrSplatAttr[];
  componentArgs: readonly ComponentArg[];
  modifiers: readonly (ElementModifier | ResolvedElementModifier)[];
}

/**
 * Corresponds to a simple HTML element. The AST allows component arguments and modifiers to support
 * future extensions.
 */
export class SimpleElementNode extends node('SimpleElement').fields<SimpleElementOptions>() {
  get args(): ComponentArgs {
    let entries = this.componentArgs as ComponentArg[]; // cast to non-readonly

    return EmptyComponentArgs(
      ComponentNamedArguments(SpanList.range(entries, this.tag.loc.collapse('end')), entries)
    );
  }
}

export type ElementNode =
  | NamedBlock
  | InvokeAngleBracketComponent
  | InvokeResolvedAngleBracketComponent
  | SimpleElementNode;
