import type { SourceSlice } from '../../source/slice';
import type { Args } from './args';
import { NamedArgument } from './args';
import type { CallNodeFields } from './base';
import type { ExpressionNode } from './expr';
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
export class HtmlAttr extends AstNode implements AttributeNodeOptions {
  readonly type = 'HtmlAttr';

  declare name: SourceSlice;
  declare value: ExpressionNode;
  declare trusting: boolean;

  /**
   * Classic HTML attributes use a heuristic to determine whether the attribute
   * is an attribute or a property. This behavior is not particularly compatible
   * with Server Side Rendering and is implementation-defined, but handles a
   * number of use-cases in the real-world and removing it would be a breaking
   * change.
   *
   * Strict attributes are always treated as attributes, and are enabled when
   * compiling a template by passing `{ strict: { attributes: true } }` to the
   * compiler.
   */
  declare strict: boolean;
}

export class SplatAttr extends AstNode {
  readonly type = 'SplatAttr';
  declare symbol: number;
}

/**
 * Corresponds to an argument passed by a component (`@x=<value>`)
 */
export class ComponentArg extends AstNode {
  readonly type = 'ComponentArg';
  declare name: SourceSlice;
  declare value: ExpressionNode;
  declare trusting: boolean;

  /**
   * Convert the component argument into a named argument node
   */
  toNamedArgument(): NamedArgument {
    return NamedArgument.of({
      name: this.name,
      value: this.value,
      loc: this.loc,
    });
  }
}

/**
 * An `ElementModifier` is just a normal call node in modifier position.
 */
export class ElementModifier extends AstNode implements CallNodeFields {
  readonly type = 'ElementModifier';
  declare callee: ExpressionNode;
  declare args: Args;
}

export interface AttributeNodeOptions {
  name: SourceSlice;
  value: ExpressionNode;
  trusting: boolean;
}
