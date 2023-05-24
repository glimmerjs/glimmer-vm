import type { AttrNamespace } from '@simple-dom/interface';
import type { Nullable } from '../core';

export interface MinimalDocument {
  readonly nodeType: number;
  readonly ownerDocument: MinimalDocument | null;

  createElementNS(ns: Nullable<string>, tag: string): MinimalElement;
  createTextNode(text: string): MinimalText;
  createComment(data: string): MinimalComment;

  insertBefore(newChild: MinimalChild, nextSibling: MinimalChild | null): void;
}

export type MinimalCursor = [
  parent: MinimalParent,
  nextSibling: MinimalChild | null,
  parentCursor: MinimalCursor | null
];

export interface MinimalChild {
  readonly nodeType: number;
  readonly parentNode: MinimalParent | null;
  readonly nextSibling: MinimalChild | null;
  readonly previousSibling: MinimalChild | null;

  replaceWith(...nodes: (MinimalChild | string)[]): void;
}

export interface MinimalParent {
  readonly nodeType: number;
  readonly firstChild: MinimalChild | null;
  readonly lastChild: MinimalChild | null;
  readonly ownerDocument: MinimalDocument;

  insertBefore(newChild: MinimalChild, nextSibling: MinimalChild | null): void;
}

export interface MinimalText extends MinimalChild {
  readonly data: string;
}

export interface MinimalComment extends MinimalChild {
  readonly data: string;
}

export interface MinimalElement extends MinimalChild, MinimalParent {
  readonly nodeType: number;
  readonly namespaceURI: string | null;
  insertAdjacentHTML(position: 'beforeend' | 'beforebegin', html: string): void;
  insertBefore(newChild: MinimalChild, nextSibling: MinimalChild | null): void;
  setAttribute(name: string, value: string): void;
  setAttributeNS(namespace: AttrNamespace, name: string, value: string): void;
}

export interface MinimalDocumentFragment extends MinimalChild, MinimalParent {
  readonly nodeType: number;
  readonly ownerDocument: MinimalDocument;
}

export interface DebugDOMTreeBuilder {
  readonly cursor: MinimalCursor;
  /**
   * Element Buffer
   */
  readonly constructing: unknown | null;

  /**
   * Verify that pushes and pops are balanced.
   */
  readonly finalize: () => void;
}

interface ElementRef {
  current: Element | null;
}

export interface DOMTreeBuilder {
  readonly debug?: DebugDOMTreeBuilder;
  readonly _constructing_: ElementRef;

  startBlock(): BlockBoundsRef;
  endBlock(): BlockBoundsRef;

  return(): BlockBoundsRef;

  text(text: string): MinimalText;
  html(html: string): [start: MinimalChild | null, end: MinimalChild | null];
  child(child: MinimalChild): MinimalChild;
  comment(data: string): MinimalComment;
  startElement(tag: string): void;
  addAttr(attributeName: string, attributeValue: unknown): AttributeRef;
  flushElement(): MinimalElement;
  endElement(): MinimalElement;

  recover(): void;

  readonly _currentElement_: MinimalElement | null;
}

export type AttributeValue = string | boolean | undefined;
export type AttributeRef = [qualifiedName: string, element: Element | null];

export interface MinimalBlockBoundsRef {
  current: MinimalBlockBounds | null;
}

export interface RuntimeBlockBoundsRef {
  current: RuntimeBlockBounds | null;
}

export type BlockBoundsRef =
  | MinimalBlockBoundsRef
  | RuntimeBlockBoundsRef
  | {
      current: BlockBounds;
    };

export type BoundsEdgeFor<B extends BlockBoundsRef> = B extends RuntimeBlockBoundsRef
  ? ChildNode
  : MinimalChild;

export interface MinimalBlockBounds {
  parent: MinimalParent;
  start: MinimalChild;
  end: MinimalChild;
}

export interface RuntimeBlockBounds {
  parent: Element;
  start: ChildNode | RuntimeBlockBoundsRef;
  end: ChildNode | RuntimeBlockBoundsRef;
}

export type BlockBounds = MinimalBlockBounds | RuntimeBlockBounds;
