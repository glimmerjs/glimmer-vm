import { setLocalDebugType } from '@glimmer/debug-util';
import { assign } from '@glimmer/util';

import type { SourceSpan } from '../../source/span';

export interface BaseNodeFields {
  loc: SourceSpan;
}

export interface AbstractNode extends BaseNodeFields {
  type: string;
}

interface TypedNodeDefinition<T extends string> {
  fields<Fields extends object>(): TypedNodeConstructor<T, Fields & BaseNodeFields>;
}

interface NodeDefinition {
  fields<Fields extends object>(): NodeConstructor<Fields & BaseNodeFields>;
}

export type ValidatedPhase = 'validated';
export type UnvalidatedPhase = 'unvalidated';
export type Phase = ValidatedPhase | UnvalidatedPhase;

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

export function node<T extends string>(name: T): TypedNodeDefinition<T>;
export function node<T extends string>(name?: T): NodeDefinition | TypedNodeDefinition<T> {
  if (name !== undefined) {
    const type = name;
    return {
      fields<Fields extends object>(): TypedNodeConstructor<T, BaseNodeFields & Fields> {
        return class {
          // SAFETY: initialized via `assign` in the constructor.
          declare readonly loc: SourceSpan;
          readonly type: T;

          constructor(fields: BaseNodeFields & Fields) {
            this.type = type;
            assign(this, fields);

            setLocalDebugType('syntax:mir:node', this);
          }
        } as TypedNodeConstructor<T, BaseNodeFields & Fields>;
      },
    };
  } else {
    return {
      fields<Fields>(): NodeConstructor<Fields & BaseNodeFields> {
        return class {
          // SAFETY: initialized via `assign` in the constructor.
          declare readonly loc: SourceSpan;

          constructor(fields: BaseNodeFields & Fields) {
            assign(this, fields);
          }
        } as NodeConstructor<BaseNodeFields & Fields>;
      },
    };
  }
}

export interface NodeConstructor<Fields> {
  new (fields: Fields): Readonly<Fields>;
}

type TypedNode<T extends string, Fields> = {
  type: T;
} & Readonly<Fields>;

export interface TypedNodeConstructor<T extends string, Fields> {
  new (options: Fields): TypedNode<T, Fields>;
}
