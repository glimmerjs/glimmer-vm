import type {
  Bounds,
  Cursor,
  DOMEnvironment,
  Nullable,
  SimpleElement,
  SimpleNode,
  UpdatableBounds,
} from '@glimmer/interfaces';
import { expect } from '@glimmer/util';

export class CursorImpl<E extends DOMEnvironment = DOMEnvironment> implements Cursor {
  constructor(public element: E['element'], public nextSibling: Nullable<E['child']>) {}
}

export type DestroyableBounds = Bounds;

export class ConcreteBounds implements Bounds {
  readonly #first: SimpleNode;
  readonly #last: SimpleNode;

  constructor(public parentNode: SimpleElement, first: SimpleNode, last: SimpleNode) {
    this.#first = first;
    this.#last = last;
  }

  parentElement(): SimpleElement {
    return this.parentNode;
  }

  firstNode(): SimpleNode {
    return this.#first;
  }

  lastNode(): SimpleNode {
    return this.#last;
  }
}

export class SingleNodeBounds implements Bounds {
  readonly #parentNode: SimpleElement;
  readonly #node: SimpleNode;

  constructor(parentNode: SimpleElement, node: SimpleNode) {
    this.#parentNode = parentNode;
    this.#node = node;
  }

  parentElement(): SimpleElement {
    return this.#parentNode;
  }

  firstNode(): SimpleNode {
    return this.#node;
  }

  lastNode(): SimpleNode {
    return this.#node;
  }
}

/** @__INLINE__ */
function withBounds(
  bounds: UpdatableBounds,
  action: (parent: Element, node: ChildNode) => void
): ChildNode | null {
  let parent = bounds.parentElement();
  let first = bounds.firstNode();
  let last = bounds.lastNode();

  let current = first;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let next = current.nextSibling;
    action(parent, current);

    if (current === last) return next;
    current = expect(next, 'invalid bounds');
  }
}

export const move = (bounds: UpdatableBounds, reference: Nullable<Node>): Nullable<Node> =>
  // eslint-disable-next-line unicorn/prefer-modern-dom-apis
  withBounds(bounds, (parent, node) => parent.insertBefore(node, reference));

export const clear = (bounds: UpdatableBounds): Nullable<ChildNode> =>
  withBounds(bounds, (parent, node) => node.remove());
