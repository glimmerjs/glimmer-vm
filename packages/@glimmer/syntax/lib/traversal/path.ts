import type * as ASTv1 from '../v1/api';
import type { VisitableNode } from '../v1/visitor-keys';

export default class WalkerPath<N extends VisitableNode> {
  node: N;
  parent: WalkerPath<VisitableNode> | null;
  parentKey: string | null;

  constructor(
    node: N,
    parent: WalkerPath<VisitableNode> | null = null,
    parentKey: string | null = null
  ) {
    this.node = node;
    this.parent = parent;
    this.parentKey = parentKey;
  }

  get parentNode(): ASTv1.Node | null {
    return this.parent ? this.parent.node : null;
  }

  parents(): Iterable<WalkerPath<VisitableNode> | null> {
    return {
      [Symbol.iterator]: () => {
        return new PathParentsIterator(this);
      },
    };
  }
}

class PathParentsIterator implements Iterator<WalkerPath<VisitableNode> | null> {
  path: WalkerPath<VisitableNode>;

  constructor(path: WalkerPath<VisitableNode>) {
    this.path = path;
  }

  next() {
    if (this.path.parent) {
      this.path = this.path.parent;
      return { done: false, value: this.path };
    } else {
      return { done: true, value: null };
    }
  }
}
