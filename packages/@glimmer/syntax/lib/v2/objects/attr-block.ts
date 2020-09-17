import { BaseNode, BaseNodeOptions, BaseCall } from './base';
import { ExpressionNode } from './expr';
import { SourceSlice } from './internal';

export interface AttrNodeOptions extends BaseNodeOptions {
  name: SourceSlice;
  value: ExpressionNode;
  trusting: boolean;
}

export abstract class BaseAttrNode extends BaseNode {
  readonly name: SourceSlice;
  readonly value: ExpressionNode;
  readonly trusting: boolean;

  constructor(options: AttrNodeOptions) {
    super(options);
    this.name = options.name;
    this.value = options.value;
    this.trusting = options.trusting;
  }
}

export class HtmlAttr extends BaseAttrNode {
  readonly type = 'HtmlAttr';
}

export class ElementArg extends BaseAttrNode {
  readonly type = 'Arg';
}

export type AttrNode = HtmlAttr | ElementArg;

export class ElementModifier extends BaseCall {
  readonly type = 'ElementModifier';
}

export type AttrBlockNode = AttrNode | ElementModifier;
