import type { SymbolTable } from '../../-internal';
import { SourceSlice, SpanList } from '../../-internal';
import type {
  ComponentArg,
  ElementModifier,
  ExpressionNode,
  HtmlOrSplatAttr,
  NamedBlock,
  NamedBlocks,
} from './-internal';
import { Args, BaseNodeFields, CallFields, Named, node } from './-internal';

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
      return Args.empty(this.value.loc.collapse('end'));
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

export class SimpleElement extends node('SimpleElement').fields<SimpleElementOptions>() {
  get args(): Args {
    let entries = this.componentArgs.map((a) => a.toNamedEntry());

    return Args.named(
      new Named({
        loc: SpanList.range(entries, this.tag.loc.collapse('end')),
        entries,
      })
    );
  }
}

export type ElementNode = NamedBlock | InvokeComponent | SimpleElement;
