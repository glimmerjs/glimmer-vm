import { assign } from '@glimmer/util';

import { SourceSpan } from '../../source/span';

export interface BaseNodeFields {
  loc: SourceSpan;
}

class BaseNodeClass {
  declare _loc?: SourceSpan;
  declare loc: SourceSpan;
  constructor(fields: object & { loc: SourceSpan }) {
    Object.defineProperty(this, 'loc', {
      get() {
        return this._loc ?? fields.loc;
      },
      set(value) {
        this._loc = value;
      },
    });
    assign(this, fields);
  }
}

const nodeKlassCache: Record<string, unknown> = {};

function cachedClass<T>(nodeName: T) {
  if (!(nodeName in nodeKlassCache)) {
    nodeKlassCache[(nodeName as unknown) as string] = class NodeKlass extends BaseNodeClass {
      type: T = nodeName;
    };
  }

  return nodeKlassCache[(nodeName as unknown) as string];
}

function klassForNode<T>(nodeName: T | undefined) {
  if (nodeName === undefined) {
    return BaseNodeClass;
  } else {
    return cachedClass<T>(nodeName);
  }
}

/**
 * This is a convenience function for creating ASTv2 nodes, with an optional name and the node's
 * options.
 *
 * ```ts
 * export class HtmlText extends node('HtmlText').fields<{ chars: string }>() {}
 * ```
 *
 * This creates a new ASTv2 node with the name `'HtmlText'` and one field `chars: string` (in
 * addition to a `loc: SourceOffsets` field, which all nodes have).
 *
 * ```ts
 * export class Args extends node().fields<{
 *  positional: PositionalArguments;
 *  named: NamedArguments
 * }>() {}
 * ```
 *
 * This creates a new un-named ASTv2 node with two fields (`positional: Positional` and `named:
 * Named`, in addition to the generic `loc: SourceOffsets` field).
 *
 * Once you create a node using `node`, it is instantiated with all of its fields (including `loc`):
 *
 * ```ts
 * new HtmlText({ loc: offsets, chars: someString });
 * ```
 */
export function node(): {
  fields<Fields extends object>(): NodeConstructor<Fields & BaseNodeFields>;
};
export function node<T extends string>(
  name: T
): {
  fields<Fields extends object>(): TypedNodeConstructor<T, Fields & BaseNodeFields>;
};
export function node<T extends string>(
  name?: T
):
  | {
      fields<Fields extends object>(): TypedNodeConstructor<T, Fields & BaseNodeFields>;
    }
  | {
      fields<Fields extends object>(): NodeConstructor<Fields & BaseNodeFields>;
    } {
  return {
    fields<Fields>(): NodeConstructor<Fields & BaseNodeFields> {
      return klassForNode<T>(name) as NodeConstructor<Fields & BaseNodeFields>;
    },
  };
}

export interface NodeConstructor<Fields> {
  new (fields: Fields): Readonly<Fields>;
}

type TypedNode<T extends string, Fields> = { type: T } & Readonly<Fields>;

export interface TypedNodeConstructor<T extends string, Fields> {
  new (options: Fields): TypedNode<T, Fields>;
}
