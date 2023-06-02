import type { AttrNamespace } from '@simple-dom/interface';
import type { Destroyable, Nullable, Optional } from '../core';

export interface MinimalDocument {
  readonly nodeType: number;
  readonly ownerDocument: MinimalDocument | null;

  createElementNS(ns: Nullable<string>, tag: string): MinimalElement;
  createTextNode(text: string): MinimalText;
  createComment(data: string): MinimalComment;

  insertBefore(newChild: MinimalChild, nextSibling: MinimalChild | null): void;
}

export type MinimalCursor = [parent: MinimalParent, nextSibling: MinimalChild | null];

export type MinimalInternalCursor = [
  parent: MinimalParent,
  nextSibling: MinimalChild | null,
  parentCursor: MinimalInternalCursor | null
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

  innerHTML: string;

  insertBefore(newChild: MinimalChild, nextSibling: MinimalChild | null): void;
}

export interface MinimalText extends MinimalChild {
  nodeValue: string;
}

export interface MinimalComment extends MinimalChild {
  nodeValue: string;
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
  readonly cursor: MinimalInternalCursor;
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

export interface DOMTreeBuilderInterface {
  readonly debug?: DebugDOMTreeBuilder;
  readonly _currentTag_: string | null;

  startBlock(): void;
  endBlock(): void;
  return(): void;

  text(text: string): void;
  html(html: string): void;
  comment(data: string): void;
  startElement(tag: string): void;
  addAttr(attributeName: string, attributeValue: unknown): void;
  flushElement(): void;
  endElement(): void;

  /**
   * Reset the builder's state.
   */
  recover(): void;
}

export interface ServerTreeBuilderInterface extends DOMTreeBuilderInterface {
  readonly type: 'server';

  _flush_(): string;
}

export interface CustomTreeBuilderInterface<Output> extends DOMTreeBuilderInterface {
  readonly type: 'custom';

  flush(): Output;
}

export interface BrowserTreeBuilderInterface extends DOMTreeBuilderInterface {
  readonly type: 'browser';

  readonly _constructing_: ElementRef;
  readonly _currentElement_: MinimalElement | null;
  readonly _root_: MinimalElement | null;

  startBlock(): BlockBoundsRef;
  endBlock(): BlockBoundsRef;
  return(): BlockBoundsRef;

  text(text: string): MinimalText;
  html(html: string): [start: MinimalChild | null, end: MinimalChild | null];
  child(child: MinimalChild): MinimalChild;
  comment(data: string): MinimalComment;
  startElement(tag: string): void;
  addAttr(attributeName: string, attributeValue: unknown): AttributeRef;
  addProp(propName: string, insert: (value: Element) => void): PropRef;
  flushElement(): MinimalElement;
  endElement(): MinimalElement;
  startInElement(cursor: MinimalCursor, guid: string): void;
  endInElement(): Destroyable;
}

export type TreeBuilder =
  | ServerTreeBuilderInterface
  | BrowserTreeBuilderInterface
  | CustomTreeBuilderInterface<unknown>;

export type AttributeValue = Optional<string | boolean>;
export type AttributeRef = [qualifiedName: string, element: Nullable<Element>];

export type IREF_NAME = 0;
export type IREF_ELEMENT = 1;

export type PropRef = [
  propName: string,
  element: Nullable<Element>,
  insert: (element: Element) => void
];

export type IPROP_REF_VALUE = 2;

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
