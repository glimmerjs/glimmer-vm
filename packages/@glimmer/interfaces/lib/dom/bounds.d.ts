import type { Nullable } from '../core';
import type { SimpleElement, SimpleNode } from './simple';

export interface Bounds<E extends DOMEnvironment = DOMEnvironment> {
  // a method to future-proof for wormholing; may not be needed ultimately
  parentElement(): E['element'];
  firstNode(): E['child'];
  lastNode(): E['child'];
}

export type UpdatableBounds = Bounds<BrowserDOMEnvironment>;

export interface Cursor<E extends DOMEnvironment = DOMEnvironment> {
  readonly element: E['element'];
  readonly nextSibling: Nullable<E['child']>;
}

export interface DOMEnvironment {
  element: Element | SimpleElement;
  child: SimpleNode | ChildNode;
}

export interface SimpleDOMEnvironment extends DOMEnvironment {
  element: SimpleElement;
  child: SimpleNode;
}

export interface BrowserDOMEnvironment extends DOMEnvironment {
  element: Element;
  child: ChildNode;
}
