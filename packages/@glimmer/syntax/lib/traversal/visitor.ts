import type * as ASTv1 from '../v1/api';
import type { VisitorKey } from '../v1/visitor-keys';
import type WalkerPath from './path';

interface FullNodeTraversal<N extends ASTv1.Node> {
  enter?(node: N, path: WalkerPath<N>): void;
  exit?(node: N, path: WalkerPath<N>): void;
  keys?: KeysVisitor<N>;
}

export type NodeHandler<N extends ASTv1.Node> = (node: N, path: WalkerPath<N>) => void;
export type NodeTraversal<N extends ASTv1.Node> = FullNodeTraversal<N> | NodeHandler<N>;

export type NodeVisitor = { [P in keyof ASTv1.Nodes]?: NodeTraversal<ASTv1.Nodes[P]> } & {
  All?: NodeTraversal<ASTv1.Node>;

  /**
   * @deprecated use Template or Block instead
   */
  Program?: NodeTraversal<ASTv1.Template | ASTv1.Block>;
};

interface FullKeyTraversal<N extends ASTv1.Node, K extends string> {
  enter?(node: N, key: K): void;
  exit?(node: N, key: K): void;
}

export type KeyHandler<N extends ASTv1.Node, K extends VisitorKey<N>> = (node: N, key: K) => void;
export type KeyTraversal<N extends ASTv1.Node, K extends VisitorKey<N>> =
  | FullKeyTraversal<N, K>
  | KeyHandler<N, K>;

type KeysVisitor<N extends ASTv1.Node> = { [P in VisitorKey<N>]?: KeyTraversal<N, P> } & {
  All?: KeyTraversal<N, VisitorKey<N>>;

  /**
   * @deprecated use Template or Block instead
   */
  Program?: KeyTraversal<ASTv1.Template | ASTv1.Block, 'body'>;
};
