import { ConcreteBounds } from "@glimmer/runtime";
import * as Simple from '../dom/interfaces';

export function insertHTMLBefore(this: void, parent: HTMLElement, nextSibling: Node, html: string, uselessElement: HTMLElement) {
  let prev = nextSibling ? nextSibling.previousSibling : parent.lastChild;
  let last: Simple.Node | null;

  if (html === null || html === '') {
    return new ConcreteBounds(parent, null, null);
  }

  if (nextSibling === null) {
    parent.insertAdjacentHTML('beforeend', html);
    last = parent.lastChild;
  } else if (nextSibling instanceof HTMLElement) {
    nextSibling.insertAdjacentHTML('beforebegin', html);
    last = nextSibling.previousSibling;
  } else {
    // Non-element nodes do not support insertAdjacentHTML, so add an
    // element and call it on that element. Then remove the element.
    //
    // This also protects Edge, IE and Firefox w/o the inspector open
    // from merging adjacent text nodes. See ./compat/text-node-merging-fix.ts
    parent.insertBefore(uselessElement, nextSibling);
    uselessElement.insertAdjacentHTML('beforebegin', html);
    last = uselessElement.previousSibling;
    parent.removeChild(uselessElement);
  }

  let first = prev ? prev.nextSibling : parent.firstChild;
  return new ConcreteBounds(parent, first, last);
}
