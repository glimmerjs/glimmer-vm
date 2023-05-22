import type { Nullable } from '../core';
import type {
  SimpleComment,
  SimpleDocumentFragment,
  SimpleElement,
  SimpleNode,
  SimpleText,
} from './simple';

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

export type TextFor<E extends DOMEnvironment> = Extract<Text | SimpleText, E['child']>;
export type CommentFor<E extends DOMEnvironment> = Extract<Comment | SimpleComment, E['child']>;
export type NodeFor<
  E extends DOMEnvironment,
  N extends Node | SimpleNode = Node | SimpleNode
> = E extends BrowserDOMEnvironment ? Extract<N, Node> : Extract<N, SimpleNode>;
export type ChildNodeFor<E extends DOMEnvironment> = TextFor<E> | CommentFor<E> | E['element'];
export type DocumentFragmentFor<E extends DOMEnvironment> = NodeFor<
  E,
  DocumentFragment | SimpleDocumentFragment
>;

export interface SimpleDOMEnvironment extends DOMEnvironment {
  element: SimpleElement;
  child: SimpleNode;
}

export interface BrowserDOMEnvironment extends DOMEnvironment {
  element: Element;
  child: ChildNode;
}
