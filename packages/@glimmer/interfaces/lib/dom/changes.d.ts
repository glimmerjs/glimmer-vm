import {
  Namespace,
  SimpleComment,
  SimpleElement,
  SimpleNode,
  SimpleText,
} from '@simple-dom/interface';
import { Optional } from '../core';
import { Bounds } from './bounds';

export interface GlimmerDOMOperations {
  createElement(tag: string, context?: SimpleElement): SimpleElement;
  insertBefore(parent: SimpleElement, node: SimpleNode, reference: Optional<SimpleNode>): void;
  insertHTMLBefore(parent: SimpleElement, nextSibling: Optional<SimpleNode>, html: string): Bounds;
  createTextNode(text: string): SimpleText;
  createComment(data: string): SimpleComment;
}

export interface GlimmerTreeChanges extends GlimmerDOMOperations {
  setAttribute(element: SimpleElement, name: string, value: string): void;
  removeAttribute(element: SimpleElement, name: string): void;
  insertAfter(element: SimpleElement, node: SimpleNode, reference: SimpleNode): void;
}

export interface GlimmerTreeConstruction extends GlimmerDOMOperations {
  setAttribute(
    element: SimpleElement,
    name: string,
    value: string,
    namespace?: Optional<Namespace>
  ): void;
}
