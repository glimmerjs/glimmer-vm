/**
 * Content Nodes are allowed in content positions in templates
 */

import { SymbolTable } from '../../symbol-table';
import { ElementModifier } from '../nodes-v2';
import { ElementArg, HtmlAttr } from './attr-block';
import { BaseNode, BaseNodeOptions, BaseCall, CallOptions } from './base';
import { ExpressionNode } from './expr';
import { NamedBlock, NamedBlocks, SourceSlice } from './internal';

export type ContentNode =
  | HtmlText
  | HtmlComment
  | AppendContent
  | InvokeBlock
  | InvokeComponent
  | SimpleElement
  | GlimmerComment;

export class GlimmerComment extends BaseNode {
  readonly type = 'GlimmerComment';
  readonly text: SourceSlice;

  constructor(options: BaseNodeOptions & { text: SourceSlice }) {
    super(options);
    this.text = options.text;
  }
}

export class HtmlText extends BaseNode {
  readonly type = 'HtmlText';
  readonly chars: string;

  constructor(options: BaseNodeOptions & { chars: string }) {
    super(options);
    this.chars = options.chars;
  }
}

export class HtmlComment extends BaseNode {
  readonly type = 'HtmlComment';
  readonly text: SourceSlice;

  constructor(options: BaseNodeOptions & { text: SourceSlice }) {
    super(options);
    this.text = options.text;
  }
}

export class AppendContent extends BaseNode {
  readonly type = 'AppendContent';
  readonly value: ExpressionNode;
  readonly trusting: boolean;

  // TODO special-case debugger and partial
  readonly table: SymbolTable;

  constructor(
    options: BaseNodeOptions & { value: ExpressionNode; trusting: boolean; table: SymbolTable }
  ) {
    super(options);
    this.value = options.value;
    this.trusting = options.trusting;
    this.table = options.table;
  }
}

export class InvokeBlock extends BaseCall {
  readonly type = 'InvokeBlock';
  readonly blocks: NamedBlocks;

  constructor(options: CallOptions & { blocks: NamedBlocks }) {
    super(options);
    this.blocks = options.blocks;
  }
}

interface InvokeComponentOptions extends BaseNodeOptions {
  callee: ExpressionNode;
  blocks: NamedBlock | NamedBlock[];
  attrs: HtmlAttr[];
  args: ElementArg[];
  modifiers: ElementModifier[];
}

export class InvokeComponent extends BaseNode {
  readonly type = 'InvokeComponent';
  readonly callee: ExpressionNode;
  readonly blocks: NamedBlock | readonly NamedBlock[];
  readonly attrs: readonly HtmlAttr[];
  readonly args: readonly ElementArg[];
  readonly modifiers: readonly ElementModifier[];

  constructor(options: InvokeComponentOptions) {
    super(options);
    this.callee = options.callee;
    this.blocks = options.blocks;
    this.attrs = options.attrs;
    this.args = options.args;
    this.modifiers = options.modifiers;
  }
}

interface SimpleElementOptions extends BaseNodeOptions {
  tag: SourceSlice;
  body: ContentNode[];
  attrs: HtmlAttr[];
  args: ElementArg[];
  modifiers: ElementModifier[];
}

export class SimpleElement extends BaseNode {
  readonly type = 'SimpleElement';
  readonly tag: SourceSlice;
  readonly body: readonly ContentNode[];
  readonly attrs: readonly HtmlAttr[];
  readonly args: readonly ElementArg[];
  readonly modifiers: readonly ElementModifier[];

  constructor(options: SimpleElementOptions) {
    super(options);
    this.tag = options.tag;
    this.body = options.body;
    this.attrs = options.attrs;
    this.args = options.args;
    this.modifiers = options.modifiers;
  }
}

export type ElementNode = NamedBlock | InvokeComponent | SimpleElement;
