import type {
  Bounds,
  Cursor,
  DOMEnvironment,
  Nullable,
  UpdatableBounds,
} from '@glimmer/interfaces';
import { expect } from '@glimmer/util';

export class CursorImpl<E extends DOMEnvironment = DOMEnvironment> implements Cursor {
  constructor(public element: E['element'], public nextSibling: Nullable<E['child']>) {}
}

export type DestroyableBounds = Bounds;

export class ConcreteBounds<E extends DOMEnvironment = DOMEnvironment> implements Bounds<E> {
  readonly #first: E['child'];
  readonly #last: E['child'];

  constructor(public parentNode: E['element'], first: E['child'], last: E['child']) {
    this.#first = first;
    this.#last = last;
  }

  parentElement(): E['element'] {
    return this.parentNode;
  }

  firstNode(): E['child'] {
    return this.#first;
  }

  lastNode(): E['child'] {
    return this.#last;
  }
}

export class SingleNodeBounds<E extends DOMEnvironment = DOMEnvironment> implements Bounds<E> {
  readonly #parentNode: E['element'];
  readonly #node: E['child'];

  constructor(parentNode: E['element'], node: E['child']) {
    this.#parentNode = parentNode;
    this.#node = node;
  }

  parentElement(): E['element'] {
    return this.#parentNode;
  }

  firstNode(): E['child'] {
    return this.#node;
  }

  lastNode(): E['child'] {
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
