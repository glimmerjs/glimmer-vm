import type { DOMTreeConstruction, TreeBuilder } from '@glimmer/dom-change-list';
import type {
  Namespace,
  NodeTokens,
  Nullable,
  PresentArray,
  SimpleAttr,
  SimpleDocumentFragment,
  SimpleElement,
} from '@glimmer/interfaces';
import { COMMENT_NODE, ELEMENT_NODE, NS_SVG, NS_XLINK, TEXT_NODE } from '@glimmer/util';
import Serializer from '@simple-dom/serializer';
import voidMap from '@simple-dom/void-map';



export function toHTML(parent: SimpleElement | SimpleDocumentFragment) {
  let serializer = new Serializer(voidMap);

  return serializer.serializeChildren(parent);
}

export function toHTMLNS(parent: SimpleElement | SimpleDocumentFragment) {
  let serializer = new NamespacedHTMLSerializer(voidMap);

  return serializer.serializeChildren(parent);
}

class NamespacedHTMLSerializer extends Serializer {
  override openTag(element: SimpleElement): string {
    return element.namespaceURI === NS_SVG ? `<svg:${element.tagName.toLowerCase()}${this.attributes(element.attributes)}>` : super.openTag(element);
  }

  override closeTag(element: SimpleElement): string {
    return element.namespaceURI === NS_SVG ? `</svg:${element.tagName.toLowerCase()}>` : super.closeTag(element);
  }

  override attr(original: SimpleAttr): string {
    let attribute: { name: string; value: Nullable<string>; specified: boolean };
    attribute = original.namespaceURI === NS_XLINK ? {
        name: `xlink:${original.name}`,
        value: original.value,
        specified: original.specified,
      } : original;

    return super.attr(attribute as SimpleAttr);
  }
}

export interface ExpectedToken {
  type: 'element' | 'text' | 'comment';
  value: string;
}

export class Builder {
  protected expected: PresentArray<ExpectedToken>;

  constructor(protected tree: DOMTreeConstruction | TreeBuilder) {
    this.expected = [{ type: 'element', value: '<undefined>' }];
  }

  appendTo(parent: SimpleElement | SimpleDocumentFragment) {
    this.expected[0].value = parent.nodeType === 1 ? parent.tagName : '#document-fragment';
  }

  closeElement() {
    this.tree.closeElement();
  }

  setAttribute(name: string, value: string, namespace?: Namespace) {
    this.tree.setAttribute(name, value, namespace);
  }

  appendText(text: string) {
    let token = this.tree.appendText(text);
    this.expected[token] = { type: 'text', value: text };
  }

  appendComment(text: string) {
    let token = this.tree.appendComment(text);
    this.expected[token] = { type: 'comment', value: text };
  }

  reify(tokens: NodeTokens): { actual: ExpectedToken[]; expected: ExpectedToken[] } {
    let actual: ExpectedToken[] = [];
    let { expected } = this;

    for (let index = 0; index < expected.length; index++) {
      let reified = tokens.reify(index);

      switch (reified.nodeType) {
        case ELEMENT_NODE:
          actual.push({ type: 'element', value: reified.tagName });
          break;
        case TEXT_NODE:
          actual.push({ type: 'text', value: reified.nodeValue });
          break;
        case COMMENT_NODE:
          actual.push({ type: 'comment', value: reified.nodeValue });
          break;
      }
    }

    return { expected, actual };
  }
}

export {NS_XLINK as XLINK} from '@glimmer/util';