import { assign } from '@glimmer/util';

import type { SourceSpan } from '../../source/span';
import type { Expand } from '@glimmer/interfaces';

export interface BaseNodeFields {
  loc: SourceSpan;
}

type IfEquals<X, Y, A = X, B = never> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y
  ? 1
  : 2
  ? A
  : B;

type WritableKeys<T> = {
  [P in keyof T]-?: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, P>;
}[keyof T];

type FieldNamesFor<A extends AstNode> = {
  [P in WritableKeys<Omit<A, 'type'>>]: A[P] extends Function ? never : P;
}[WritableKeys<Omit<A, 'type'>>];

type FieldsFor<A extends AstNode> = Expand<{
  [P in FieldNamesFor<A>]: A[P];
}>;

export abstract class AstNode {
  static of<T extends AstNode>(this: new (...args: any[]) => T, fields: FieldsFor<T>): T {
    return new this(fields);
  }

  abstract readonly type: string;
  declare loc: SourceSpan;

  /** @deprecated use {@link AstNode.of} */
  constructor(fields: any, _internal: `don't call the constructor directly`) {
    Object.assign(this, fields);
  }
}

/**
 * This is a convenience function for creating ASTv2 nodes, with an optional name and the node's
 * options.
 *
 * ```ts
 * export class HtmlText extends AstNode{}
 * ```
 *
 * This creates a new ASTv2 node with the name `'HtmlText'` and one field `chars: string` (in
 * addition to a `loc: SourceOffsets` field, which all nodes have).
 *
 * ```ts
 * export class Args extends AstNode {
  readonly type = ;
   *  positional: PositionalArguments;
 *  named: NamedArguments
 *
}
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
  if (name === undefined) {
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
  } else {
    let type = name;
    return {
      fields<Fields extends object>(): TypedNodeConstructor<T, BaseNodeFields & Fields> {
        return class {
          // SAFETY: initialized via `assign` in the constructor.
          declare readonly loc: SourceSpan;
          readonly type: T;

          constructor(fields: BaseNodeFields & Fields) {
            this.type = type;
            assign(this, fields);
          }
        } as TypedNodeConstructor<T, BaseNodeFields & Fields>;
      },
    };
  }
}

export interface NodeConstructor<Fields> {
  new (fields: Fields): Readonly<Fields>;
}

type TypedNode<T extends string, Fields> = { type: T } & Readonly<Fields>;

export interface TypedNodeConstructor<T extends string, Fields> {
  new (options: Fields): TypedNode<T, Fields>;
}
