import { SimpleDocumentFragment, SimpleElement, SimpleNode } from '@simple-dom/interface';
import { Option } from '../core';

export interface Bounds {
  // a method to future-proof for wormholing; may not be needed ultimately
  parentElement(): SimpleElement;
  firstNode(): SimpleNode;
  lastNode(): SimpleNode;
}

export interface Cursor {
  readonly element: SimpleElement | SimpleDocumentFragment;
  readonly nextSibling: Option<SimpleNode>;
}
