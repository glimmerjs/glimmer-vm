import { setLocalDebugType } from '@glimmer/debug-util';

import type { SourceSpan } from '../../source/span';

export interface BaseNodeFields {
  loc: SourceSpan;
}

/**
 * This is a convenience function for creating ASTv2 nodes, with an optional name and the node's
 * options.
 *
 * ```ts
 * export const HtmlTextFields: NodeConstructor<'HtmlText', { chars: string }> = AstNode('HtmlText');
 * export class HtmlText extends HtmlTextFields {}
 * ```
 *
 * This creates a new ASTv2 node with the name `'HtmlText'` and one field `chars: string` (in
 * addition to a `loc: SourceOffsets` field, which all nodes have).
 *
 * ```ts
 * export const ArgsFields: NodeConstructor<{
 *   positional: PositionalArguments;
 *   named: NamedArguments
 * }> = AstNode();
 * ```
 *
 * This creates a new un-named ASTv2 node with two fields (`positional: Positional` and `named:
 * Named`, in addition to the generic `loc: SourceOffsets` field).
 *
 * Once you create a node using `AstNode`, it is instantiated with all of its fields (including `loc`):
 *
 * ```ts
 * new HtmlText({ loc: offsets, chars: someString });
 * ```
 */
export function AstNode<T extends string, Fields extends object>(
  type: T
): NodeConstructor<T, BaseNodeFields & Fields>;
export function AstNode<Fields extends object>(): AnonymousNodeConstructor<BaseNodeFields & Fields>;
export function AstNode<T extends string, Fields extends object>(
  type?: T
):
  | NodeConstructor<string, BaseNodeFields & Fields>
  | AnonymousNodeConstructor<BaseNodeFields & Fields> {
  return class {
    // SAFETY: initialized via `assign` in the constructor.
    declare readonly loc: SourceSpan;
    readonly type: string;

    constructor(fields: BaseNodeFields & Fields) {
      this.type = type ?? 'anonymous';
      Object.assign(this, fields);

      setLocalDebugType('syntax:mir:node', this);
    }
  } as NodeConstructor<T, BaseNodeFields & Fields>;
}

type TypedNode<T extends string, Fields> = {
  type: T;
} & Readonly<Fields>;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NodeConstructor<T extends string, Fields = {}> {
  new (options: Fields & BaseNodeFields): TypedNode<T, Fields & BaseNodeFields>;
}

export interface AnonymousNodeConstructor<Fields> {
  new (options: Fields & BaseNodeFields): Readonly<Fields & BaseNodeFields>;
}
