import type {
  ATag,
  ClassAttr,
  Dict,
  DivTag,
  HrefAttr,
  IdAttr,
  NameAttr,
  PTag,
  SpanTag,
  StyleAttr,
  TypeAttr,
  ValueAttr,
  WellKnownAttrName,
  WellKnownTagName,
} from '@glimmer/interfaces';

// There is a small whitelist of namespaced attributes specially
// enumerated in
// https://www.w3.org/TR/html/syntax.html#attributes-0
//
// > When a foreign element has one of the namespaced attributes given by
// > the local name and namespace of the first and second cells of a row
// > from the following table, it must be written using the name given by
// > the third cell from the same row.
//
// In all other cases, colons are interpreted as a regular character
// with no special meaning:
//
// > No other namespaced attribute can be expressed in the HTML syntax.

const XLINK = 'http://www.w3.org/1999/xlink';
const XML = 'http://www.w3.org/XML/1998/namespace';
const XMLNS = 'http://www.w3.org/2000/xmlns/';

const WHITELIST: Dict<string | undefined> = {
  'xlink:actuate': XLINK,
  'xlink:arcrole': XLINK,
  'xlink:href': XLINK,
  'xlink:role': XLINK,
  'xlink:show': XLINK,
  'xlink:title': XLINK,
  'xlink:type': XLINK,
  'xml:base': XML,
  'xml:lang': XML,
  'xml:space': XML,
  xmlns: XMLNS,
  'xmlns:xlink': XMLNS,
};

export function getAttrNamespace(attrName: string): string | undefined {
  return WHITELIST[attrName];
}

const DEFLATE_TAG_TABLE: {
  [tagName: string]: WellKnownTagName | undefined;
} = {
  div: 0 satisfies DivTag,
  span: 1 satisfies SpanTag,
  p: 2 satisfies PTag,
  a: 3 satisfies ATag,
};

const INFLATE_TAG_TABLE: {
  [I in WellKnownTagName]: string;
} = ['div', 'span', 'p', 'a'];

export function deflateTagName(tagName: string): string | WellKnownTagName {
  return DEFLATE_TAG_TABLE[tagName] ?? tagName;
}

export function inflateTagName(tagName: string | WellKnownTagName): string {
  return typeof tagName === 'string' ? tagName : INFLATE_TAG_TABLE[tagName];
}

const DEFLATE_ATTR_TABLE: {
  [tagName: string]: WellKnownAttrName | undefined;
} = {
  class: 0 satisfies ClassAttr,
  id: 1 satisfies IdAttr,
  value: 2 satisfies ValueAttr,
  name: 3 satisfies NameAttr,
  type: 4 satisfies TypeAttr,
  style: 5 satisfies StyleAttr,
  href: 6 satisfies HrefAttr,
};

const INFLATE_ATTR_TABLE: {
  [I in WellKnownAttrName]: string;
} = ['class', 'id', 'value', 'name', 'type', 'style', 'href'];

export function deflateAttrName(attrName: string): string | WellKnownAttrName {
  return DEFLATE_ATTR_TABLE[attrName] ?? attrName;
}

export function inflateAttrName(attrName: string | WellKnownAttrName): string {
  return typeof attrName === 'string' ? attrName : INFLATE_ATTR_TABLE[attrName];
}
