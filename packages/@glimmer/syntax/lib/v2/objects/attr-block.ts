import { NamedEntry } from './args';
import { CallFields, node } from './base';
import type { ExpressionNode } from './expr';
import { SourceSlice } from '../../source/slice';

/**
 * Attr nodes look like HTML attributes, but are classified as:
 *
 * 1. `HtmlAttr`, which means a regular HTML attribute in Glimmer
 * 2. `SplatAttr`, which means `...attributes`
 * 3. `ComponentArg`, which means an attribute whose name begins with `@`, and it is therefore a
 *    component argument.
 */
export type AttrNode = HtmlAttr | SplatAttr | ComponentArg;

/**
 * `HtmlAttr` and `SplatAttr` are grouped together because the order of the `SplatAttr` node,
 * relative to other attributes, matters.
 */
export type HtmlOrSplatAttr = HtmlAttr | SplatAttr;

/**
 * "Attr Block" nodes are allowed inside an open element tag in templates. They interact with the
 * element (or component).
 */
export type AttrBlockNode = AttrNode | ElementModifier;

/**
 * `HtmlAttr` nodes are valid HTML attributes, with or without a value.
 *
 * Exceptions:
 *
 * - `...attributes` is `SplatAttr`
 * - `@x=<value>` is `ComponentArg`
 */
export class HtmlAttr extends node('HtmlAttr').fields<AttrNodeOptions>() {}

export class SplatAttr extends node('SplatAttr').fields() {}

export class ComponentArg extends node().fields<AttrNodeOptions>() {
  toNamedEntry(): NamedEntry {
    return new NamedEntry({
      name: this.name,
      value: this.value,
    });
  }
}

export class ElementModifier extends node('ElementModifier').fields<CallFields>() {}

export interface AttrNodeOptions {
  name: SourceSlice;
  value: ExpressionNode;
  trusting: boolean;
}
