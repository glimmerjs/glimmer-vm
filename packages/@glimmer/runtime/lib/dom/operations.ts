/* eslint-disable unicorn/prefer-dom-node-remove */
/* eslint-disable unicorn/prefer-modern-dom-apis */

import type {
  Bounds,
  Nullable,
  SimpleComment,
  SimpleDocument,
  SimpleElement,
  SimpleNode,
  SimpleText,
  InsertPosition,
} from '@glimmer/interfaces';
import {
  castToBrowser,
  expect,
  INSERT_BEFORE_BEGIN,
  INSERT_BEFORE_END,
  NS_SVG,
} from '@glimmer/util';

import { ConcreteBounds } from '../bounds';

// http://www.w3.org/TR/html/syntax.html#html-integration-point
const SVG_INTEGRATION_POINTS = 'foreignObject|desc|title'.split('|');

// http://www.w3.org/TR/html/syntax.html#adjust-svg-attributes
// TODO: Adjust SVG attributes

// http://www.w3.org/TR/html/syntax.html#parsing-main-inforeign
// TODO: Adjust SVG elements

// http://www.w3.org/TR/html/syntax.html#parsing-main-inforeign
export const DISALLOWED_FOREIGN_TAGS = new Set();

export class DOMOperations {
  protected declare uselessElement: SimpleElement; // Set by this.setupUselessElement() in constructor

  constructor(protected document: SimpleDocument) {
    this.setupUselessElement();
  }

  // split into separate method so that NodeDOMTreeConstruction
  // can override it.
  protected setupUselessElement() {
    this.uselessElement = this.document.createElement('template');
  }

  createElement(tag: string, context?: SimpleElement): SimpleElement {
    let isElementInSVGNamespace: boolean, isHTMLIntegrationPoint: boolean;

    if (context) {
      isElementInSVGNamespace = context.namespaceURI === NS_SVG || tag === 'svg';
      isHTMLIntegrationPoint = SVG_INTEGRATION_POINTS.includes(context.tagName);
    } else {
      isElementInSVGNamespace = tag === 'svg';
      isHTMLIntegrationPoint = false;
    }

    if (isElementInSVGNamespace && !isHTMLIntegrationPoint) {
      // FIXME: This does not properly handle <font> with color, face, or
      // size attributes, which is also disallowed by the spec. We should fix
      // this.
      if (DISALLOWED_FOREIGN_TAGS.has(tag)) {
        throw new Error(`Cannot create a ${tag} inside an SVG context`);
      }

      return this.document.createElementNS(NS_SVG, tag);
    } else {
      return this.document.createElement(tag);
    }
  }

  insertBefore(parent: SimpleElement, node: SimpleNode, reference: Nullable<SimpleNode>) {
    parent.insertBefore(node, reference);
  }

  insertHTMLBefore(parent: SimpleElement, nextSibling: Nullable<SimpleNode>, html: string): Bounds {
    if (html === '') {
      const comment = this.createComment('');
      parent.insertBefore(comment, nextSibling);
      return new ConcreteBounds(parent, comment, comment);
    }

    const previous = nextSibling ? nextSibling.previousSibling : parent.lastChild;
    let last: SimpleNode;

    if (nextSibling === null) {
      insertAdjacentHTML(parent, INSERT_BEFORE_END, html);
      last = expect(parent.lastChild, 'bug in insertAdjacentHTML?');
    } else if (nextSibling instanceof HTMLElement) {
      insertAdjacentHTML(nextSibling, INSERT_BEFORE_BEGIN, html);
      last = expect(nextSibling.previousSibling, 'bug in insertAdjacentHTML?');
    } else {
      // Non-element nodes do not support insertAdjacentHTML, so add an
      // element and call it on that element. Then remove the element.
      //
      // This also protects Edge, IE and Firefox w/o the inspector open
      // from merging adjacent text nodes. See ./compat/text-node-merging-fix.ts
      const { uselessElement } = this;

      parent.insertBefore(uselessElement, nextSibling);
      insertAdjacentHTML(castToBrowser(uselessElement, 'ELEMENT'), INSERT_BEFORE_BEGIN, html);
      last = expect(uselessElement.previousSibling, 'bug in insertAdjacentHTML?');
      parent.removeChild(uselessElement);
    }

    const first = expect(
      previous ? previous.nextSibling : parent.firstChild,
      'bug in insertAdjacentHTML?'
    );
    return new ConcreteBounds(parent, first, last);
  }

  createTextNode(text: string): SimpleText {
    return this.document.createTextNode(text);
  }

  createComment(data: string): SimpleComment {
    return this.document.createComment(data);
  }
}

export function moveNodesBefore(
  source: SimpleNode,
  target: SimpleElement,
  nextSibling: Nullable<SimpleNode>
): Bounds {
  const first = expect(source.firstChild, 'source is empty');
  let last: SimpleNode = first;
  let current: Nullable<SimpleNode> = first;

  while (current) {
    const next: Nullable<SimpleNode> = current.nextSibling;

    target.insertBefore(current, nextSibling);

    last = current;
    current = next;
  }

  return new ConcreteBounds(target, first, last);
}

function insertAdjacentHTML(
  element: Element | SimpleElement,
  position: InsertPosition,
  html: string
): void {
  element.insertAdjacentHTML(position, html);
}
