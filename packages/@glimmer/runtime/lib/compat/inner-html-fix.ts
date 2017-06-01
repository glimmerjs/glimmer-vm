import { Bounds, ConcreteBounds } from '../bounds';
import { moveNodesBefore } from '../dom/helper';
import { APPLY_TABLE_FIXES } from "@glimmer/feature-flags";

export interface Wrapper {
  depth: number;
  before: string;
  after: string;
}

let _innerHTMLWrapper = {};
if (APPLY_TABLE_FIXES) {
  _innerHTMLWrapper = {
    colgroup: { depth: 2, before: '<table><colgroup>', after: '</colgroup></table>' },
    table:    { depth: 1, before: '<table>', after: '</table>' },
    tbody:    { depth: 2, before: '<table><tbody>', after: '</tbody></table>' },
    tfoot:    { depth: 2, before: '<table><tfoot>', after: '</tfoot></table>' },
    thead:    { depth: 2, before: '<table><thead>', after: '</thead></table>' },
    tr:       { depth: 3, before: '<table><tbody><tr>', after: '</tr></tbody></table>' }
  };
}

export const innerHTMLWrapper = _innerHTMLWrapper;

// Patch:    innerHTML Fix
// Browsers: IE9
// Reason:   IE9 don't allow us to set innerHTML on col, colgroup, frameset,
//           html, style, table, tbody, tfoot, thead, title, tr.
// Fix:      Wrap the innerHTML we are about to set in its parents, apply the
//           wrapped innerHTML on a div, then move the unwrapped nodes into the
//           target position.
export function fixTables(parent: HTMLElement, wrapper: Wrapper, div: HTMLElement, html: string, reference: Node): Bounds {
  if (APPLY_TABLE_FIXES) {
    let wrappedHtml = wrapper.before + html + wrapper.after;

    div.innerHTML = wrappedHtml;

    let parentNode: Node = div;

    for (let i=0; i<wrapper.depth; i++) {
      parentNode = parentNode.childNodes[0];
    }

    let [first, last] = moveNodesBefore(parentNode, parent, reference);
    return new ConcreteBounds(parent, first, last);
  } else {
    return new ConcreteBounds(parent, div.firstChild, reference.lastChild);
  }
}

export function shouldFixTables(document: Document) {
  if (APPLY_TABLE_FIXES) {
    let table = document.createElement('table');
    try {
      table.innerHTML = '<tbody></tbody>';
    } catch (e) {
    } finally {
      if (table.childNodes.length !== 0) {
        // It worked as expected, no fix required
        return false;
      }
    }

    return true;
  }

  return;
}
