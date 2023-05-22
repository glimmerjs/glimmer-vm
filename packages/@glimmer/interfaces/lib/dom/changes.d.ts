import type { Nullable } from '../core';
import type { Bounds, BrowserDOMEnvironment, CommentFor, DOMEnvironment, TextFor } from './bounds';
import type { Namespace } from './simple';

export interface GlimmerDOMOperations<E extends DOMEnvironment = DOMEnvironment> {
  createElement(tag: string, context?: E['element']): E['element'];
  insertBefore(parent: E['element'], node: E['child'], reference: Nullable<E['child']>): void;
  insertHTMLBefore(
    parent: E['element'],
    nextSibling: Nullable<E['child']>,
    html: string
  ): Bounds<E>;
  createTextNode(text: string): TextFor<E>;
  createComment(data: string): CommentFor<E>;
}

export interface GlimmerTreeChanges extends GlimmerDOMOperations<BrowserDOMEnvironment> {
  setAttribute(element: Element, name: string, value: string): void;
  removeAttribute(element: Element, name: string): void;
  insertAfter(element: Element, node: ChildNode, reference: ChildNode): void;
}

export interface GlimmerTreeConstruction<E extends DOMEnvironment = DOMEnvironment>
  extends GlimmerDOMOperations<E> {
  setAttribute(
    element: E['element'],
    name: string,
    value: string,
    namespace?: Nullable<Namespace>
  ): void;
}
