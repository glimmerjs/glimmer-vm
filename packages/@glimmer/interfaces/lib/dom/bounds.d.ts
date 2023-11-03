import type { Nullable } from '../core';
import type { SomeBoundsDebug } from './attributes';
import type { SimpleElement, SimpleNode } from './simple';

export interface FirstNode {
  debug?: () => SomeBoundsDebug;

  // `firstNode()` is allowed to throw during construction
  firstNode(): SimpleNode;
}

export interface LastNode {
  debug?: () => SomeBoundsDebug;

  // `lastNode()` is allowed to throw during construction
  lastNode(): SimpleNode;
}

export interface BlockBounds extends FirstNode, LastNode {
  // a method to future-proof for wormholing; may not be needed ultimately
  parentElement(): SimpleElement;
  firstNode(): SimpleNode;
  lastNode(): SimpleNode;

  debug?: () => SomeBoundsDebug;
}

export type PartialBounds = FirstNode | LastNode;
export type Bounds = BlockBounds | PartialBounds;

export interface Cursor {
  readonly element: SimpleElement;
  readonly nextSibling: Nullable<SimpleNode>;
}
