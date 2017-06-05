import { Bounds, ConcreteBounds, SingleNodeBounds } from '../bounds';
import {
  needsInnerHTMLFix,
  fix as innerHTMLFix
} from '../compat/inner-html-fix';
import {
  needsSVGInnerHTMLFix,
  fix as svgFix
} from '../compat/svg-inner-html-fix';
import {
  needsTextNodeFix,
  fix as textNodeFix
} from '../compat/text-node-merging-fix';
import { insertHTMLBefore as _insertHTMLBefore } from '../compat/insert-html-before';
import * as Simple from './interfaces';

import { Option } from '@glimmer/util';

export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

// http://www.w3.org/TR/html/syntax.html#html-integration-point
const SVG_INTEGRATION_POINTS = { foreignObject: 1, desc: 1, title: 1 };

// http://www.w3.org/TR/html/syntax.html#adjust-svg-attributes
// TODO: Adjust SVG attributes

// http://www.w3.org/TR/html/syntax.html#parsing-main-inforeign
// TODO: Adjust SVG elements

// http://www.w3.org/TR/html/syntax.html#parsing-main-inforeign
export const BLACKLIST_TABLE = Object.create(null);

([
  "b", "big", "blockquote", "body", "br", "center", "code", "dd", "div", "dl", "dt", "em", "embed",
  "h1", "h2", "h3", "h4", "h5", "h6", "head", "hr", "i", "img", "li", "listing", "main", "meta", "nobr",
  "ol", "p", "pre", "ruby", "s", "small", "span", "strong", "strike", "sub", "sup", "table", "tt", "u",
  "ul", "var"
]).forEach(tag => BLACKLIST_TABLE[tag] = 1);

const WHITESPACE = /[\t-\r \xA0\u1680\u180E\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/;

export function isWhitespace(string: string) {
  return WHITESPACE.test(string);
}

export interface DOMCapabilties {
  applyTextNodeFix: boolean;
  applyInnerHTMLFix: boolean;
  applySVGFix: boolean;
}

export function moveNodesBefore(source: Simple.Node, target: Simple.Element, nextSibling: Simple.Node) {
  let first = source.firstChild;
  let last: Simple.Node | null = null;
  let current = first;
  while (current) {
    last = current;
    current = current.nextSibling;
    target.insertBefore(last, nextSibling);
  }
  return [first, last];
}

export class DOMOperations {
  protected uselessElement: HTMLElement;
  protected uselessComment: Comment;
  private capabilities: DOMCapabilties = {
    applyTextNodeFix: false,
    applyInnerHTMLFix: false,
    applySVGFix: false
  };

  constructor(protected document: Simple.Document) {
    this.setupUselessElement();
    this.domCapabilities();
  }

  private domCapabilities() {
    this.capabilities.applyInnerHTMLFix = needsTextNodeFix(this.document as Document);
    this.capabilities.applyInnerHTMLFix = needsInnerHTMLFix(this.document as Document);
    this.capabilities.applySVGFix = needsSVGInnerHTMLFix(this.document as Document, SVG_NAMESPACE);
  }

  // split into seperate method so that NodeDOMTreeConstruction
  // can override it.
  protected setupUselessElement() {
    this.uselessComment = this.document.createComment('') as Comment;
    this.uselessElement = this.document.createElement('div') as HTMLElement;
  }

  createElement(tag: string, context?: Simple.Element): Simple.Element {
    let isElementInSVGNamespace: boolean, isHTMLIntegrationPoint: boolean;

    if (context) {
      isElementInSVGNamespace = context.namespaceURI === SVG_NAMESPACE || tag === 'svg';
      isHTMLIntegrationPoint = SVG_INTEGRATION_POINTS[context.tagName];
    } else {
      isElementInSVGNamespace = tag === 'svg';
      isHTMLIntegrationPoint = false;
    }

    if (isElementInSVGNamespace && !isHTMLIntegrationPoint) {
      // FIXME: This does not properly handle <font> with color, face, or
      // size attributes, which is also disallowed by the spec. We should fix
      // this.
      if (BLACKLIST_TABLE[tag]) {
        throw new Error(`Cannot create a ${tag} inside an SVG context`);
      }

      return this.document.createElementNS(SVG_NAMESPACE, tag);
    } else {
      return this.document.createElement(tag);
    }
  }

  insertBefore(parent: Simple.Element, node: Simple.Node, reference: Option<Simple.Node>) {
    parent.insertBefore(node, reference);
  }

  insertHTMLBefore(_parent: Simple.Element, nextSibling: Simple.Node, html: string): Bounds {
    let parent = _parent as HTMLElement;
    let reference = nextSibling as Element;
    return insertHTMLBefore(this.capabilities, parent, reference, html, this.uselessElement, this.uselessComment);
  }

  createTextNode(text: string): Simple.Text {
    return this.document.createTextNode(text);
  }

  createComment(data: string): Simple.Comment {
    return this.document.createComment(data);
  }
}

export namespace DOM {
  export type Node = Simple.Node;
  export type Element = Simple.Element;
  export type Document = Simple.Document;
  export type Comment = Simple.Comment;
  export type Text = Simple.Text;
  export type Namespace = Simple.Namespace;
  export type HTMLElement = Simple.HTMLElement;

  export class TreeConstruction extends DOMOperations {
    createElementNS(namespace: Namespace, tag: string): Element {
      return this.document.createElementNS(namespace, tag);
    }

    setAttribute(element: Element, name: string, value: string, namespace?: string) {
      if (namespace) {
        element.setAttributeNS(namespace, name, value);
      } else {
        element.setAttribute(name, value);
      }
    }
  }

  export const DOMTreeConstruction = TreeConstruction;
  export type DOMTreeConstruction = TreeConstruction;
}

export class DOMChanges extends DOMOperations {
  protected namespace: Option<string>;

  constructor(protected document: HTMLDocument) {
    super(document);
    this.namespace = null;
  }

  setAttribute(element: Simple.Element, name: string, value: string) {
    element.setAttribute(name, value);
  }

  setAttributeNS(element: Simple.Element, namespace: string, name: string, value: string) {
    element.setAttributeNS(namespace, name, value);
  }

  removeAttribute(element: Simple.Element, name: string) {
    element.removeAttribute(name);
  }

  removeAttributeNS(element: Simple.Element, namespace: string, name: string) {
    element.removeAttributeNS(namespace, name);
  }

  insertNodeBefore(parent: Simple.Element, node: Simple.Node, reference: Simple.Node): Bounds {
    if (isDocumentFragment(node)) {
      let { firstChild, lastChild } = node;
      this.insertBefore(parent, node, reference);
      return new ConcreteBounds(parent, firstChild, lastChild);
    } else {
      this.insertBefore(parent, node, reference);
      return new SingleNodeBounds(parent, node);
    }
  }

  insertTextBefore(parent: Simple.Element, nextSibling: Simple.Node, text: string): Simple.Text {
    let textNode = this.createTextNode(text);
    this.insertBefore(parent, textNode, nextSibling);
    return textNode;
  }

  insertBefore(element: Simple.Element, node: Simple.Node, reference: Option<Simple.Node>) {
    element.insertBefore(node, reference);
  }

  insertAfter(element: Simple.Element, node: Simple.Node, reference: Simple.Node) {
    this.insertBefore(element, node, reference.nextSibling);
  }
}

export function insertHTMLBefore(this: void, capabilities: DOMCapabilties, _parent: Simple.Element, _nextSibling: Option<Simple.Node>, html: string, _uselessElement: Simple.Element, _uselessComment: Simple.Comment): Bounds { // tslint:disable-line
  // TypeScript vendored an old version of the DOM spec where `insertAdjacentHTML`
  // only exists on `HTMLElement` but not on `Element`. We actually work with the
  // newer version of the DOM API here (and monkey-patch this method in `./compat`
  // when we detect older browsers). This is a hack to work around this limitation.
  let parent = _parent as HTMLElement;
  let uselessElement = _uselessElement as HTMLElement;
  let nextSibling = _nextSibling as Node;
  let uselessComment = _uselessComment as Comment;

  if (capabilities.applyTextNodeFix) {
    return textNodeFix(parent, nextSibling, html, uselessElement, uselessComment);
  }

  if (capabilities.applyInnerHTMLFix) {
    return innerHTMLFix(parent, nextSibling, html, uselessElement);
  }

  if (capabilities.applySVGFix) {
    return svgFix(parent, nextSibling, html, uselessElement);
  }

  return _insertHTMLBefore(parent, nextSibling, html, uselessElement);
}

function isDocumentFragment(node: Simple.Node): node is DocumentFragment {
  return node.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}

export default DOMChanges;
export const DOMTreeConstruction = DOM.DOMTreeConstruction;
export type DOMTreeConstruction = DOM.DOMTreeConstruction;
export { Namespace as DOMNamespace } from './interfaces';
