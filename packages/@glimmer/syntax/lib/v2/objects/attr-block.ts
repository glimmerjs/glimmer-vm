import type { SourceSlice } from '../../source/slice';
import type { CurlyArgs, ResolvedCallee } from './args';
import type { DynamicCallee } from './base';
import type { AttrValueNode, ExpressionValueNode, InterpolateExpression } from './expr';

import { ComponentArgument } from './args';
import { node } from './node';

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

export class SplatAttr extends node('SplatAttr').fields<{ symbol: number }>() {}

/**
 * Corresponds to an argument passed by a component (`@x=<value>`)
 */
export class ComponentArg extends node().fields<ArgNodeOptions>() {
  /**
   * Convert the component argument into a named argument node
   */
  toComponentArgument(): ComponentArgument {
    return new ComponentArgument({
      name: this.name,
      value: this.value,
    });
  }
}

/**
 * An `ElementModifier` is just a normal call node in modifier position.
 */
export class ElementModifier extends node('ElementModifier').fields<{
  callee: DynamicCallee;
  args: CurlyArgs;
}>() {
  readonly isResolved = false;
}

export class ResolvedElementModifier extends node('ResolvedElementModifier').fields<{
  callee: ResolvedCallee;
  args: CurlyArgs;
}>() {
  readonly isResolved = true;
}

export interface AttrNodeOptions {
  name: SourceSlice;
  value: ExpressionValueNode | InterpolateExpression;
  trusting: boolean;
}

export interface ArgNodeOptions {
  name: SourceSlice;
  value: AttrValueNode;
}
