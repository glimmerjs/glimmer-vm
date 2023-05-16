import type { Bounds, Cursor, Nullable, SimpleElement, SimpleNode } from '@glimmer/interfaces';
import { expect } from '@glimmer/util';

export class CursorImpl implements Cursor {
  constructor(public element: SimpleElement, public nextSibling: Nullable<SimpleNode>) {}
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

export function move(bounds: Bounds, reference: Nullable<SimpleNode>): Nullable<SimpleNode> {
  let parent = bounds.parentElement();
  let first = bounds.firstNode();
  let last = bounds.lastNode();

  let current: SimpleNode = first;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let next = current.nextSibling;

    parent.insertBefore(current, reference);

    if (current === last) {
      return next;
    }

    current = expect(next, 'invalid bounds');
  }
}

export function clear(bounds: Bounds): Nullable<SimpleNode> {
  let parent = bounds.parentElement();
  let first = bounds.firstNode();
  let last = bounds.lastNode();

  let current: SimpleNode = first;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let next = current.nextSibling;

    parent.removeChild(current);

    if (current === last) {
      return next;
    }

    current = expect(next, 'invalid bounds');
  }
}
