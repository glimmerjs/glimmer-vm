import type { InsertPosition, Namespace, NodeType } from '@glimmer/interfaces';

export const RAW_NODE = -1 satisfies NodeType.RAW_NODE;
export const ELEMENT_NODE = 1 satisfies NodeType.ELEMENT_NODE;
export const TEXT_NODE = 3 satisfies NodeType.TEXT_NODE;
export const COMMENT_NODE = 8 satisfies NodeType.COMMENT_NODE;
export const DOCUMENT_NODE = 9 satisfies NodeType.DOCUMENT_NODE;
export const DOCUMENT_TYPE_NODE = 10 satisfies NodeType.DOCUMENT_TYPE_NODE;
export const DOCUMENT_FRAGMENT_NODE = 11 satisfies NodeType.DOCUMENT_FRAGMENT_NODE;

export const NS_HTML = 'http://www.w3.org/1999/xhtml' as Namespace.HTML;
export const NS_MATHML = 'http://www.w3.org/1998/Math/MathML' as Namespace.MathML;
export const NS_SVG = 'http://www.w3.org/2000/svg' as Namespace.SVG;
export const NS_XLINK = 'http://www.w3.org/1999/xlink' as Namespace.XLink;
export const NS_XML = 'http://www.w3.org/XML/1998/namespace' as Namespace.XML;
export const NS_XMLNS = 'http://www.w3.org/2000/xmlns/' as Namespace.XMLNS;

export const INSERT_BEFORE_BEGIN = 'beforebegin' as InsertPosition.beforebegin;
export const INSERT_AFTER_BEGIN = 'afterbegin' as InsertPosition.afterbegin;
export const INSERT_BEFORE_END = 'beforeend' as InsertPosition.beforeend;
export const INSERT_AFTER_END = 'afterend' as InsertPosition.afterend;
