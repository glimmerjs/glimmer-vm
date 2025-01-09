import type { SourceSlice } from '../../source/slice';
import type { CallFields } from './base';
import type { ExpressionNode } from './expr';
import type { NodeConstructor } from './node';

import { NamedArgument } from './args';
import { AstNode } from './node';

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
export const HtmlAttrFields: NodeConstructor<'HtmlAttr', AttrNodeOptions> = AstNode('HtmlAttr');
export class HtmlAttr extends HtmlAttrFields {}

export const SplatAttrFields: NodeConstructor<'SplatAttr', { symbol: number }> =
  AstNode('SplatAttr');
export class SplatAttr extends SplatAttrFields {}

/**
 * Corresponds to an argument passed by a component (`@x=<value>`)
 */
export const ComponentArgFields: NodeConstructor<'ComponentArg', AttrNodeOptions> =
  AstNode('ComponentArg');
export class ComponentArg extends ComponentArgFields {
  /**
   * Convert the component argument into a named argument node
   */
  toNamedArgument(): NamedArgument {
    return new NamedArgument({
      name: this.name,
      value: this.value,
    });
  }
}

/**
 * An `ElementModifier` is just a normal call node in modifier position.
 */
export const ElementModifierFields: NodeConstructor<'ElementModifier', CallFields> =
  AstNode('ElementModifier');
export class ElementModifier extends ElementModifierFields {}

export interface AttrNodeOptions {
  name: SourceSlice;
  value: ExpressionNode;
  trusting: boolean;
}
