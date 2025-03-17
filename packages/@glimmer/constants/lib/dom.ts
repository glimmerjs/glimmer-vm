import type { InsertPosition, Namespace, NodeType, VmDomCloseElement, VmDomComment, VmDomDynamicAttr, VmDomDynamicModifier, VmDomFlushElement, VmDomModifier, VmDomOpenDynamicElement, VmDomOpenElement, VmDomPopRemoteElement, VmDomPushRemoteElement, VmDomStaticAttr, VmDomText } from '@glimmer/interfaces';

export const RAW_NODE = -1;
export const ELEMENT_NODE: NodeType.ELEMENT_NODE = 1;
export const TEXT_NODE: NodeType.TEXT_NODE = 3;
export const COMMENT_NODE: NodeType.COMMENT_NODE = 8;
export const DOCUMENT_NODE: NodeType.DOCUMENT_NODE = 9;
export const DOCUMENT_TYPE_NODE: NodeType.DOCUMENT_TYPE_NODE = 10;
export const DOCUMENT_FRAGMENT_NODE: NodeType.DOCUMENT_FRAGMENT_NODE = 11;

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

// DOM Opcodes - using different names to avoid conflicts with syscall-ops.ts
export const VM_DOM_TEXT_OP = 28 satisfies VmDomText;
export const VM_DOM_COMMENT_OP = 29 satisfies VmDomComment;
export const VM_DOM_OPEN_ELEMENT_OP = 30 satisfies VmDomOpenElement;
// Using a different name to avoid conflicts with syscall-ops.ts
export const VM_DOM_OPEN_DYNAMIC_ELEMENT_OP = 31 satisfies VmDomOpenDynamicElement;
export const VM_DOM_FLUSH_ELEMENT_OP = 32 satisfies VmDomFlushElement;
export const VM_DOM_CLOSE_ELEMENT_OP = 33 satisfies VmDomCloseElement;
export const VM_DOM_STATIC_ATTR_OP = 34 satisfies VmDomStaticAttr;
export const VM_DOM_DYNAMIC_ATTR_OP = 35 satisfies VmDomDynamicAttr;
export const VM_DOM_MODIFIER_OP = 36 satisfies VmDomModifier;
export const VM_DOM_DYNAMIC_MODIFIER_OP = 37 satisfies VmDomDynamicModifier;
export const VM_DOM_PUSH_REMOTE_ELEMENT_OP = 38 satisfies VmDomPushRemoteElement;
export const VM_DOM_POP_REMOTE_ELEMENT_OP = 39 satisfies VmDomPopRemoteElement;
