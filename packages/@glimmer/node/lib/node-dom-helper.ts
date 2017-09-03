import * as SimpleDOM from 'simple-dom';
import { DOMTreeConstruction, Bounds, ConcreteBounds } from '@glimmer/runtime';
import { Simple } from '@glimmer/interfaces';

export default class NodeDOMTreeConstruction extends DOMTreeConstruction {
  protected document: SimpleDOM.Document;
  constructor(doc: Simple.Document) {
    super(doc);
  }

  // override to prevent usage of `this.document` until after the constructor
  protected setupUselessElement() { }

  insertHTMLBefore(parent: Simple.Element, reference: Simple.Node, html: string): Bounds {
    let prev = reference ? reference.previousSibling : parent.lastChild;

    let raw = this.document.createRawHTMLSection(html);
    parent.insertBefore(raw, reference);

    let first = prev ? prev.nextSibling : parent.firstChild;
    let last = reference ? reference.previousSibling : parent.lastChild;

    return new ConcreteBounds(parent, first, last);
  }

  createNodeCache(tag: string) {
    if (!this.document.nodesCache) {
      this.document.nodesCache = {};
    }
    this.document.nodesCache[tag] = this.document.createElement(tag);
    return this.getNodeFromCache(tag);
  }

  hasNodeInCache(tag: string) {
    return this.document.nodesCache && this.document.nodesCache[tag];
  }

  getNodeFromCache(tag:string) {
    return this.document.nodesCache[tag].cloneNode(false);
  }

  // override to avoid SVG detection/work when in node (this is not needed in SSR)
  createElement(tag: string) {
    return this.hasNodeInCache(tag) ? this.getNodeFromCache(tag) : this.createNodeCache(tag);
  }

  // override to avoid namespace shenanigans when in node (this is not needed in SSR)
  setAttribute(element: Element, name: string, value: string) {
    element.setAttribute(name, value);
  }
}
