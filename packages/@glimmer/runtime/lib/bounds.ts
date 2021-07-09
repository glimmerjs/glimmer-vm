import { Bounds, Cursor, Option } from '@glimmer/interfaces';
import { SimpleDocumentFragment, SimpleElement, SimpleNode } from '@simple-dom/interface';
import { expect } from '@glimmer/util';

export class CursorImpl implements Cursor {
  constructor(
    public element: SimpleElement | SimpleDocumentFragment,
    public nextSibling: Option<SimpleNode>
  ) {}
}

export type DestroyableBounds = Bounds;

export class ConcreteBounds implements Bounds {
  constructor(
    public parentNode: SimpleElement,
    private first: SimpleNode,
    private last: SimpleNode
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

export class SingleNodeBounds implements Bounds {
  constructor(private parentNode: SimpleElement, private node: SimpleNode) {}

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

export function move(bounds: Bounds, reference: Option<SimpleNode>): Option<SimpleNode> {
  let parent = bounds.parentElement();
  let first = bounds.firstNode();
  let last = bounds.lastNode();

  let current: SimpleNode = first;

  while (true) {
    let next = current.nextSibling;

    if (reference !== null) {
      reference?.parentNode?.insertBefore(current, reference);
    } else {
      parent.insertBefore(current, reference);
    }

    if (current === last) {
      return next;
    }

    current = expect(next, 'invalid bounds');
  }
}

export function clear(bounds: Bounds): Option<SimpleNode> {
  let parent = bounds.parentElement();
  let first = bounds.firstNode();
  let last = bounds.lastNode();

  if (parent.nodeType === 11) {
    if (first.parentNode === last.parentNode && last.parentNode !== null) {
      if (first !== last) {
        first.parentNode?.removeChild(first);
        last.parentNode?.removeChild(last);
      } else {
        first.parentNode?.removeChild(first);
      }
    }
    return null;
  }

  let current: SimpleNode = first;

  while (true) {
    let next = current.nextSibling;
    parent.removeChild(current);

    if (current === last) {
      return next;
    }

    current = expect(next, 'invalid bounds');
  }
}
