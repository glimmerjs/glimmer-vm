import type * as ASTv1 from '../v1/api';
import type { VisitableNode, VisitorKey, VisitorKeys } from '../v1/visitor-keys';
import type WalkerPath from './path';

export interface FullNodeTraversal<N extends VisitableNode> {
  enter?(node: N, path: WalkerPath<N>): void;
  exit?(node: N, path: WalkerPath<N>): void;
  keys?: KeysVisitor<N>;
}

export type NodeHandler<N extends VisitableNode> = (
  node: N,
  path: WalkerPath<N>
) => VisitableNode | VisitableNode[] | undefined | void;
export type NodeTraversal<N extends VisitableNode> = FullNodeTraversal<N> | NodeHandler<N>;

type TypeNode<N extends VisitableNode['type']> = Extract<ASTv1.Node, { type: N }>;

export type NodeVisitor = { [P in keyof VisitorKeys]?: NodeTraversal<TypeNode<P>> } & {
  All?: NodeTraversal<VisitableNode>;

  /**
   * @deprecated use Template or Block instead
   */
  Program?: NodeTraversal<ASTv1.Template | ASTv1.Block>;
};

export interface FullKeyTraversal<N extends VisitableNode, K extends string> {
  enter?(node: N, key: K): void;
  exit?(node: N, key: K): void;
}

export type KeyHandler<N extends VisitableNode, K extends VisitorKey<N>> = (
  node: N,
  key: K
) => void;
export type KeyTraversal<N extends VisitableNode, K extends VisitorKey<N>> =
  | FullKeyTraversal<N, K>
  | KeyHandler<N, K>;

export type KeysVisitor<N extends VisitableNode> = { [P in VisitorKey<N>]?: KeyTraversal<N, P> } & {
  All?: KeyTraversal<N, VisitorKey<N>>;

  /**
   * @deprecated use Template or Block instead
   */
  Program?: KeyTraversal<ASTv1.Template | ASTv1.Block, 'body'>;
};
