import type { Bounds, Cursor, Nullable, SimpleElement, SimpleNode } from '@glimmer/interfaces';
import { setLocalDebugType } from '@glimmer/debug-util';

export class CursorImpl implements Cursor {
  constructor(
    public element: SimpleElement,
    public nextSibling: Nullable<SimpleNode>
  ) {
    setLocalDebugType('cursor', this);
  }
}

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

export function move(bounds: Bounds, reference: Nullable<SimpleNode>): Nullable<SimpleNode> {
  let parent = bounds.parentElement();
  let first = bounds.firstNode();
  let last = bounds.lastNode();

  const range = document.createRange();
  range.setStartBefore(first as unknown as Node);
  range.setEndAfter(last as unknown as Node);

  const fragment = range.extractContents();
  (parent as unknown as Element).insertBefore(fragment, reference as unknown as Nullable<Node>);

  return reference;
}

export function clear(bounds: Bounds): Nullable<SimpleNode> {
  let parent = bounds.parentElement();
  let first = bounds.firstNode();
  let last = bounds.lastNode();

  let next = last.nextSibling;

  if (first === last) {
    parent.removeChild(first);
    return next;
  }

  if (parent.firstChild === first && parent.lastChild === last) {
    (parent as unknown as Element).innerHTML = '';
    return next;
  }

  const range = document.createRange();
  range.setStartBefore(first as unknown as Node);
  range.setEndAfter(last as unknown as Node);
  range.deleteContents();

  return next;
}
