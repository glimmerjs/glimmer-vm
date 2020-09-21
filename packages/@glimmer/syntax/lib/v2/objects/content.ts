import { SymbolTable } from '../../symbol-table';
import { Args, Named } from './args';
import { ComponentArg, ElementModifier, HtmlOrSplatAttr } from './attr-block';
import { BaseNodeFields, CallFields, node } from './base';
import { ExpressionNode } from './expr';
import { NamedBlock, NamedBlocks, SourceSlice } from './internal';

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

export class GlimmerComment extends node('GlimmerComment').fields<{ text: SourceSlice }>() {}
export class HtmlText extends node('HtmlText').fields<{ chars: string }>() {}
export class HtmlComment extends node('HtmlComment').fields<{ text: SourceSlice }>() {}

export class AppendContent extends node('AppendContent').fields<{
  value: ExpressionNode;
  trusting: boolean;
  table: SymbolTable;
}>() {
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
      return Args.empty(this.value.loc.collapseEnd());
    }
  }
}

export class InvokeBlock extends node('InvokeBlock').fields<
  CallFields & { blocks: NamedBlocks }
>() {}

interface InvokeComponentOptions {
  callee: ExpressionNode;
  blocks: NamedBlocks;
  attrs: readonly HtmlOrSplatAttr[];
  componentArgs: readonly ComponentArg[];
  modifiers: readonly ElementModifier[];
}

export class InvokeComponent extends node('InvokeComponent').fields<InvokeComponentOptions>() {
  get args(): Args {
    let entries = this.componentArgs.map((a) => a.toNamedEntry());

    return Args.named(
      new Named({
        loc: this.loc.src.offsetList(entries.map((e) => e.loc)).getRangeOffset(),
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

export class SimpleElement extends node('SimpleElement').fields<SimpleElementOptions>() {
  get args(): Args {
    let entries = this.componentArgs.map((a) => a.toNamedEntry());

    return Args.named(
      new Named({
        loc: this.loc.src.offsetList(entries.map((e) => e.loc)).getRangeOffset(),
        entries,
      })
    );
  }
}

export type ElementNode = NamedBlock | InvokeComponent | SimpleElement;
