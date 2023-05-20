import type {
  Dict,
  Namespace,
  NodeToken,
  NodeTokens,
  Nullable,
  SimpleDocument,
  SimpleDocumentFragment,
  SimpleElement,
} from '@glimmer/interfaces';
import { NS_HTML, NS_SVG } from '@glimmer/util';

import { DOMTreeConstruction } from './tree-construction';

// http://www.w3.org/TR/html/syntax.html#html-integration-point
const SVG_INTEGRATION_POINTS = { foreignObject: 1, desc: 1, title: 1 };

// http://www.w3.org/TR/html/syntax.html#adjust-svg-attributes
// TODO: Adjust SVG attributes

// http://www.w3.org/TR/html/syntax.html#parsing-main-inforeign
// TODO: Adjust SVG elements

// http://www.w3.org/TR/html/syntax.html#parsing-main-inforeign
export const BLACKLIST_TABLE = Object.create(null);

for (let tag of [
  'b',
  'big',
  'blockquote',
  'body',
  'br',
  'center',
  'code',
  'dd',
  'div',
  'dl',
  'dt',
  'em',
  'embed',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'hr',
  'i',
  'img',
  'li',
  'listing',
  'main',
  'meta',
  'nobr',
  'ol',
  'p',
  'pre',
  'ruby',
  's',
  'small',
  'span',
  'strong',
  'strike',
  'sub',
  'sup',
  'table',
  'tt',
  'u',
  'ul',
  'var',
]) (BLACKLIST_TABLE[tag] = 1);

interface Context {
  tag: string;
  namespaceURI: Namespace;
  isIntegration: boolean;
}

/**
 * Implements a subset of the HTML Tree Construction
 * algorithm. The idea is you feed in syntactc elements,
 * and the tree constructor will properly handle issues
 * like void tags, namespaces, etc.
 */
export class TreeBuilder {
  private contexts: Context[] = [];

  constructor(private dom: DOMTreeConstruction = new DOMTreeConstruction()) {}

  openElement(tag: string) {
    let context = this.current;
    let isSVG: boolean;

    if (context) {
      isSVG = context.namespaceURI === NS_SVG || tag === 'svg';
      isSVG = isSVG && !context.isIntegration;
    } else {
      isSVG = tag === 'svg';
    }

    if (isSVG) {
      if (BLACKLIST_TABLE[tag]) {
        throw new Error(`Cannot create a ${tag} inside an SVG context`);
      }

      this.contexts.push({
        tag,
        namespaceURI: NS_SVG,
        isIntegration: !!(SVG_INTEGRATION_POINTS as Dict)[tag],
      });
      return this.dom.openElement(tag, NS_SVG);
    }

    this.contexts.push({ tag, namespaceURI: NS_HTML, isIntegration: false });
    return this.dom.openElement(tag);
  }

  closeElement() {
    this.dom.closeElement();
  }

  setAttribute(name: string, value: string, namespace?: Namespace) {
    this.dom.setAttribute(name, value, namespace);
  }

  appendText(text: string): NodeToken {
    return this.dom.appendText(text);
  }

  appendComment(text: string) {
    return this.dom.appendComment(text);
  }

  get currentTag(): Nullable<string> {
    let current = this.current;
    return current && current.tag;
  }

  get currentNamespace(): Nullable<Namespace> {
    let current = this.current;
    return current && current.namespaceURI;
  }

  appendTo(element: SimpleElement | SimpleDocumentFragment, owner: SimpleDocument): NodeTokens {
    return this.dom.appendTo(element, owner);
  }

  private get current(): Nullable<Context> {
    let { contexts } = this;
    let { length } = contexts;

    return length ? contexts[length - 1]! : null;
  }
}
