import { BaseNode, BaseNodeOptions, CallNode } from './base';
import { Expression } from './expr';
import { SourceSlice } from './internal';

export interface AttrNodeOptions extends BaseNodeOptions {
  name: SourceSlice;
  value: Expression;
  trusting: boolean;
}

export abstract class BaseAttrNode extends BaseNode {
  readonly name: SourceSlice;
  readonly value: Expression;
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

export class Arg extends BaseAttrNode {
  readonly type = 'Arg';
}

export type AttrNode = HtmlAttr | Arg;

export class ElementModifier extends CallNode {
  readonly type = 'ElementModifier';
}
