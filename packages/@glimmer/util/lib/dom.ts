/* eslint-disable unicorn/prefer-dom-node-remove */
import type { Nullable, SimpleElement, SimpleNode } from '@glimmer/interfaces';

export function clearElement(parent: SimpleElement | Element) {
  let current: Nullable<SimpleNode | ChildNode> = parent.firstChild;

  while (current) {
    let next = current.nextSibling;
    parent.removeChild(current);
    current = next;
  }
}
