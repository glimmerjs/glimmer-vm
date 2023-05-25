import type { SourceSlice } from '../../source/slice';
import { SpanList } from '../../source/span-list';
import type { SymbolTable } from '../../symbol-table';
import { Args, NamedArguments } from './args';
import type {
  ComponentArg as ComponentArgument,
  ElementModifier,
  HtmlOrSplatAttr as HtmlOrSplatAttribute,
} from './attr-block';
import type { ExpressionNode } from './expr';
import type { NamedBlocks, NamedBlock } from './internal-node';
import { type BaseNodeFields, AstNode } from './node';

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

export type TopLevelNode = ContentNode | NamedBlock;

export class GlimmerComment extends AstNode {
  readonly type = 'GlimmerComment';
  declare text: SourceSlice;
}

export class HtmlText extends AstNode {
  readonly type = 'HtmlText';
  declare chars: string;
}

export class HtmlComment extends AstNode {
  readonly type = 'HtmlComment';
  declare text: SourceSlice;
}

export class AppendContent extends AstNode {
  readonly type = 'AppendContent';
  declare value: ExpressionNode;
  declare trusting: boolean;
  declare table: SymbolTable;

  get callee(): ExpressionNode {
    return this.value.type === 'Call' ? this.value.callee : this.value;
  }

  get args(): Args {
    return this.value.type === 'Call'
      ? this.value.args
      : Args.empty(this.value.loc.collapse('end'));
  }
}

export class InvokeBlock extends AstNode {
  readonly type = 'InvokeBlock';
  declare callee: ExpressionNode;
  declare args: Args;
  declare blocks: NamedBlocks;
}

interface InvokeComponentFields {
  callee: ExpressionNode;
  blocks: NamedBlocks;
  attrs: readonly HtmlOrSplatAttribute[];
  componentArgs: readonly ComponentArgument[];
  modifiers: readonly ElementModifier[];
}

/**
 * Corresponds to a component invocation. When the content of a component invocation contains no
 * named blocks, `blocks` contains a single named block named `"default"`. When a component
 * invocation is self-closing, `blocks` is empty.
 */
export class InvokeComponent extends AstNode implements InvokeComponentFields {
  readonly type = 'InvokeComponent';
  declare callee: ExpressionNode;
  declare blocks: NamedBlocks;
  declare attrs: readonly HtmlOrSplatAttribute[];
  declare componentArgs: readonly ComponentArgument[];
  declare modifiers: readonly ElementModifier[];

  get args(): Args {
    let entries = this.componentArgs.map((a) => a.toNamedArgument());

    return Args.named(
       NamedArguments.of({
        loc: SpanList.range(entries, this.callee.loc.collapse('end')),
        entries,
      })
    );
  }
}

interface SimpleElementOptions extends BaseNodeFields {
  tag: SourceSlice;
  body: readonly ContentNode[];
  attrs: readonly HtmlOrSplatAttribute[];
  componentArgs: readonly ComponentArgument[];
  modifiers: readonly ElementModifier[];
}

/**
 * Corresponds to a simple HTML element. The AST allows component arguments and modifiers to support
 * future extensions.
 */
export class SimpleElement extends AstNode implements SimpleElementOptions {
  readonly type = 'SimpleElement';
  declare tag: SourceSlice<string>;
  declare body: readonly ContentNode[];
  declare attrs: readonly HtmlOrSplatAttribute[];
  declare componentArgs: readonly ComponentArgument[];
  declare modifiers: readonly ElementModifier[];

  get args(): Args {
    let entries = this.componentArgs.map((a) => a.toNamedArgument());

    return Args.named(
      NamedArguments.of({
        loc: SpanList.range(entries, this.tag.loc.collapse('end')),
        entries,
      })
    );
  }
}

export type ElementNode = NamedBlock | InvokeComponent | SimpleElement;
