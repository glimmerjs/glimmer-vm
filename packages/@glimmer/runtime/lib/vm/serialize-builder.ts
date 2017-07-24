import { NewElementBuilder, ElementBuilder } from "./element-builder";

import Bounds, { bounds, currentNode } from '../bounds';
import { Simple } from "@glimmer/interfaces";
import { Option } from "@glimmer/util";

export class SerializeBuilder extends NewElementBuilder implements ElementBuilder {
  private serializeBlockDepth = 0;

  pushRemoteElement(element: Simple.Element, cursorId: string,  nextSibling: Option<Simple.Node> = null) {
    let { dom } = this;
    let script = dom.createElement('script');
    script.setAttribute('id', cursorId);

    dom.insertBefore(element, script, nextSibling);
    super.pushRemoteElement(element, cursorId, nextSibling);
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
    return bounds(this.element, first, last);
  }

  __appendText(string: string): Simple.Text {
    let current = currentNode(this);

    if (string === '') {
      return this.__appendComment('%empty%') as any as Simple.Text;
    } else if (current && current.nodeType === Node.TEXT_NODE) {
      this.__appendComment('%sep%');
    }

    return super.__appendText(string);
  }
}
