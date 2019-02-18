import * as AST from '../types/nodes';
import { VisitorKey } from '../types/visitor-keys';

export interface FullNodeTraversal<N extends AST.AnyNode> {
  enter?(node: N): void;
  exit?(node: N): void;
  keys?: KeysVisitor<N>;
}

export type NodeHandler<N extends AST.AnyNode> = (node: N) => void;
export type NodeTraversal<N extends AST.AnyNode> = FullNodeTraversal<N> | NodeHandler<N>;

export type NodeVisitor = { [P in keyof AST.Nodes]?: NodeTraversal<AST.Nodes[P]> } & {
  All?: NodeTraversal<AST.AnyNode>;
};

export interface FullKeyTraversal<N extends AST.AnyNode, K extends string> {
  enter?(node: N, key: K): void;
  exit?(node: N, key: K): void;
}

export type KeyHandler<N extends AST.AnyNode, K extends VisitorKey<N>> = (node: N, key: K) => void;
export type KeyTraversal<N extends AST.AnyNode, K extends VisitorKey<N>> =
  | FullKeyTraversal<N, K>
  | KeyHandler<N, K>;

export type KeysVisitor<N extends AST.AnyNode> = { [P in VisitorKey<N>]?: KeyTraversal<N, P> } & {
  All?: KeyTraversal<N, VisitorKey<N>>;
};
