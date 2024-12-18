import type { SourceSlice } from '../../source/slice';
import type { SymbolTable } from '../../symbol-table';
import type { ComponentArg, ElementModifier, HtmlOrSplatAttr } from './attr-block';
import type { CallFields } from './base';
import type { ExpressionNode } from './expr';
import type { NamedBlock, NamedBlocks } from './internal-node';
import type { BaseNodeFields, NodeConstructor } from './node';

import { SpanList } from '../../source/span-list';
import { Args, NamedArguments } from './args';
import { AstNode } from './node';

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
  | InvokeBlock
  | InvokeComponent
  | SimpleElement
  | GlimmerComment;

export const GlimmerCommentFields: NodeConstructor<'GlimmerComment', { text: SourceSlice }> =
  AstNode('GlimmerComment');
export class GlimmerComment extends GlimmerCommentFields {}

export const HtmlTextFields: NodeConstructor<'HtmlText', { chars: string }> = AstNode('HtmlText');
export class HtmlText extends HtmlTextFields {}

export const HtmlCommentFields: NodeConstructor<'HtmlComment', { text: SourceSlice }> =
  AstNode('HtmlComment');
export class HtmlComment extends HtmlCommentFields {}

export const AppendContentFields: NodeConstructor<
  'AppendContent',
  { value: ExpressionNode; trusting: boolean; table: SymbolTable }
> = AstNode('AppendContent');
export class AppendContent extends AppendContentFields {
  get callee(): ExpressionNode {
    if (this.value.type === 'Call') {
      return this.value.callee;
    } else {
      return this.value;
    }
  }

  get args(): Args {
    if (this.value.type === 'Call') {
      return this.value.args;
    } else {
      return Args.empty(this.value.loc.collapse('end'));
    }
  }
}

export const InvokeBlockFields: NodeConstructor<
  'InvokeBlock',
  CallFields & { blocks: NamedBlocks }
> = AstNode('InvokeBlock');
export class InvokeBlock extends InvokeBlockFields {}

/**
 * Corresponds to a component invocation. When the content of a component invocation contains no
 * named blocks, `blocks` contains a single named block named `"default"`. When a component
 * invocation is self-closing, `blocks` is empty.
 */
export const InvokeComponentFields: NodeConstructor<
  'InvokeComponent',
  {
    callee: ExpressionNode;
    blocks: NamedBlocks;
    attrs: readonly HtmlOrSplatAttr[];
    componentArgs: readonly ComponentArg[];
    modifiers: readonly ElementModifier[];
  }
> = AstNode('InvokeComponent');
export class InvokeComponent extends InvokeComponentFields {
  get args(): Args {
    let entries = this.componentArgs.map((a) => a.toNamedArgument());

    return Args.named(
      new NamedArguments({
        loc: SpanList.range(entries, this.callee.loc.collapse('end')),
        entries,
      })
    );
  }
}

interface SimpleElementOptions extends BaseNodeFields {
  tag: SourceSlice;
  body: readonly ContentNode[];
  attrs: readonly HtmlOrSplatAttr[];
  componentArgs: readonly ComponentArg[];
  modifiers: readonly ElementModifier[];
}

/**
 * Corresponds to a simple HTML element. The AST allows component arguments and modifiers to support
 * future extensions.
 */
export const SimpleElementFields: NodeConstructor<'SimpleElement', SimpleElementOptions> =
  AstNode('SimpleElement');
export class SimpleElement extends SimpleElementFields {
  get args(): Args {
    let entries = this.componentArgs.map((a) => a.toNamedArgument());

    return Args.named(
      new NamedArguments({
        loc: SpanList.range(entries, this.tag.loc.collapse('end')),
        entries,
      })
    );
  }
}

export type ElementNode = NamedBlock | InvokeComponent | SimpleElement;
