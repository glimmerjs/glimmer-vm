import { NewElementBuilder, ElementBuilder, Bounds, ConcreteBounds } from "@glimmer/runtime";

import { Simple, Option } from "@glimmer/interfaces";
import NodeDOMTreeConstruction from "./node-dom-helper";

export function stringBuilder(document: Simple.Document, cursor: { element: Simple.Element, nextSibling: Option<Simple.Node> }): ElementBuilder {
  return StringBuilder.forInitialRender(document, cursor);
}

export function serializeBuilder(document: Simple.Document, cursor: { element: Simple.Element, nextSibling: Option<Simple.Node> }): ElementBuilder {
  return SerializeBuilder.forInitialRender(document, cursor);
}

class StringBuilder extends NewElementBuilder {
  constructor(protected doc: Simple.Document, cursor: { element: Simple.Element, nextSibling: Option<Simple.Node> }) {
    super(doc, cursor);
    this.dom = new NodeDOMTreeConstruction(doc);
  }
}

class SerializeBuilder extends NewElementBuilder implements ElementBuilder {
  private serializeBlockDepth = 0;

  constructor(protected doc: Simple.Document, cursor: { element: Simple.Element, nextSibling: Option<Simple.Node> }) {
    super(doc, cursor);
    this.dom = new NodeDOMTreeConstruction(doc);
  }

  __openBlock(): void {
    let depth = this.serializeBlockDepth++;
    this.__appendComment(`%+block:${depth}%`);

    super.__openBlock();
  }

  __closeBlock(): void {
    super.__closeBlock();
    this.__appendComment(`%-block:${--this.serializeBlockDepth}%`);
  }

  __appendHTML(html: string): Bounds {
    let first = this.__appendComment('%glimmer%');
    super.__appendHTML(html);
    let last = this.__appendComment('%glimmer%');
    return new ConcreteBounds(this.element, first, last);
  }

  __appendText(string: string): Simple.Text {
    let current = currentNode(this);

    if (string === '') {
      return this.__appendComment('%empty%') as any as Simple.Text;
    } else if (current && current.nodeType === 3) {
      this.__appendComment('%sep%');
    }

    return super.__appendText(string);
  }
}

export function currentNode(cursor: { element: Simple.Element, nextSibling: Option<Simple.Node> }): Option<Simple.Node> {
  let { element, nextSibling } = cursor;

  if (nextSibling === null) {
    return element.lastChild;
  } else {
    return nextSibling.previousSibling;
  }
}
