import type { BrowserDOMEnvironment, GlimmerTreeChanges, Nullable } from '@glimmer/interfaces';

import { DISALLOWED_FOREIGN_TAGS, DOMOperations } from './operations';

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
])
  DISALLOWED_FOREIGN_TAGS.add(tag);

const WHITESPACE =
  /[\t\n\v\f\r \u{A0}\u{1680}\u{180E}\u{2000}-\u{200A}\u{2028}\u{2029}\u{202F}\u{205F}\u{3000}\u{FEFF}]/u;

export function isWhitespace(string: string) {
  return WHITESPACE.test(string);
}

export class DOMChangesImpl
  extends DOMOperations<BrowserDOMEnvironment>
  implements GlimmerTreeChanges
{
  protected namespace: Nullable<string>;

  constructor(protected override document: Document) {
    super(document);
    this.namespace = null;
  }

  setAttribute(element: Element, name: string, value: string) {
    element.setAttribute(name, value);
  }

  removeAttribute(element: Element, name: string) {
    element.removeAttribute(name);
  }

  insertAfter(element: Element, node: ChildNode, reference: ChildNode) {
    this.insertBefore(element, node, reference.nextSibling);
  }
}

let helper = DOMChangesImpl;

export const DOMChanges = helper;
export { DOMTreeConstruction } from './api';
