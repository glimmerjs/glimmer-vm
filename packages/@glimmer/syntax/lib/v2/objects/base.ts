import type { SerializedSourceSpan, SourceSpan } from '../../-internal';
import type {
  AppendContent,
  Args,
  CallExpression,
  ContentNode,
  ElementModifier,
  ExpressionNode,
  InvokeBlock,
  InvokeComponent,
} from './-internal';

export interface BaseNodeFields {
  loc: SourceSpan;
}

export interface SerializedBaseNode {
  loc: SerializedSourceSpan;
}

export abstract class AbstractNode<Fields extends BaseNodeFields = BaseNodeFields> {
  readonly loc: SourceSpan;

  constructor({ loc }: Fields) {
    this.loc = loc;
  }
}

export abstract class AbstractTypedNode<
  T extends string,
  Fields extends BaseNodeFields = BaseNodeFields
> {
  readonly loc: SourceSpan;

  constructor(readonly type: T, { loc }: Fields) {
    this.loc = loc;
  }
}

export interface GlimmerParentNodeOptions extends BaseNodeFields {
  body: readonly ContentNode[];
}

export interface CallFields extends BaseNodeFields {
  callee: ExpressionNode;
  args: Args;
}

export type CallNode =
  | CallExpression
  | InvokeBlock
  | AppendContent
  | InvokeComponent
  | ElementModifier;

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
 * export class Args extends node().fields<{ positional: Positional; named: Named }>() {}
 * ```
 *
 * This creates a new un-named ASTv2 node with two fields (`positional: Positional` and
 * `named: Named`, in addition to the generic `loc: SourceOffsets` field).
 *
 * Once you create a node using `node`, it is instantiated with all of its fields (including
 * `loc`):
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
  if (name !== undefined) {
    return {
      fields<Fields extends object>(): TypedNodeConstructor<T, Fields> {
        return class extends AbstractTypedNode<T, BaseNodeFields & Fields> {
          constructor(options: BaseNodeFields & Fields) {
            super(name as T, options);

            copy(options, (this as unknown) as ConstructingTypedNode<T, Fields>);
          }
        } as TypedNodeConstructor<T, Fields>;
      },
    };
  } else {
    return {
      fields<Fields>(): NodeConstructor<Fields> {
        return class extends AbstractNode<BaseNodeFields & Fields> {
          constructor(options: BaseNodeFields & Fields) {
            super(options);

            copy(options, (this as unknown) as ConstructingNode<Fields>);
          }
        } as NodeConstructor<Fields>;
      },
    };
  }
}

type ConstructingTypedNode<T extends string, Fields> = AbstractTypedNode<T> &
  Fields &
  BaseNodeFields;

type ConstructingNode<Fields> = AbstractNode & BaseNodeFields & Fields;

export type NodeConstructor<Fields> = {
  new (options: Fields): AbstractNode & Readonly<Fields>;
};

type TypedNode<T extends string, Fields> = AbstractTypedNode<T> & Readonly<Fields>;

export type TypedNodeConstructor<T extends string, Fields> = {
  new (options: Fields): TypedNode<T, Fields>;
};

function keys<O extends object>(object: O): (keyof O)[] {
  return Object.keys(object) as (keyof O)[];
}

function copy<O extends object>(object1: O, object2: O) {
  for (let key of keys(object1)) {
    object2[key] = object1[key];
  }
}
