import type { BlockBounds, Cursor, Nullable, SimpleElement, SimpleNode } from '@glimmer/interfaces';
import { expect } from '@glimmer/util';

export class CursorImpl implements Cursor {
  constructor(
    public element: SimpleElement,
    public nextSibling: Nullable<SimpleNode>
  ) {}
}

export type DestroyableBounds = BlockBounds;

export class ConcreteBounds implements BlockBounds {
  constructor(
    public parentNode: SimpleElement,
    readonly first: SimpleNode,
    readonly last: SimpleNode
  ) {}

  parentElement(): SimpleElement {
    return this.parentNode;
  }

  firstNode(): SimpleNode {
    return this.first;
  }

  lastNode(): SimpleNode {
    return this.last;
  }
}

export class SingleNodeBounds implements BlockBounds {
  readonly first: SimpleNode;
  readonly last: SimpleNode;

  constructor(
    private parentNode: SimpleElement,
    private node: SimpleNode
  ) {
    this.first = this.last = node;
  }

  parentElement(): SimpleElement {
    return this.parentNode;
  }

  firstNode(): SimpleNode {
    return this.node;
  }

  lastNode(): SimpleNode {
    return this.node;
  }
}

export function move(bounds: BlockBounds, reference: Nullable<SimpleNode>): Nullable<SimpleNode> {
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

export function clear(bounds: BlockBounds): Nullable<SimpleNode> {
  let parent = bounds.parentElement();
  let first = bounds.firstNode();
  let last = bounds.lastNode();

  return clearRange({ parent, first, last });
}

export function clearRange({
  parent,
  first,
  last,
}: {
  parent: SimpleElement;
  first: Nullable<SimpleNode>;
  last: Nullable<SimpleNode>;
}): Nullable<SimpleNode> {
  let current: Nullable<SimpleNode> = first ?? parent.firstChild;

  if (!current) {
    return null;
  }

  while (current) {
    const next: Nullable<SimpleNode> = current.nextSibling;

    parent.removeChild(current);

    if (current === last) {
      return next;
    }

    current = next;
  }

  return null;
}
