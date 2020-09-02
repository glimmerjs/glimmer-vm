import { unreachable } from '@glimmer/util';
import {
  Namespace,
  NodeType,
  SimpleDocument,
  SimpleElement,
  SimpleNode,
} from '@simple-dom/interface';

/**
 * The base class for DOM nodes that were already validated as browser DOM nodes
 */
class BrowserNodeUtils<B extends BrowserNode = BrowserNode, S extends SimpleNode = SimpleNode> {
  constructor(readonly node: B) {}

  /**
   * Return the backing node as an equivalent SimpleNode
   */
  get simple(): S {
    return (this.node as unknown) as S;
  }
}

/**
 * This class provides utilities for interacting with an Element that was
 * already validated as a browser Element.
 */
class BrowserElementUtils<E extends Element, S extends SimpleElement> extends BrowserNodeUtils<
  E,
  S
> {
  /**
   * Get the DOM namespace for the backing element.
   *
   * @see {Namespace}
   */
  get namespaceURI(): Namespace | null {
    return this.node.namespaceURI as Namespace | null;
  }

  /**
   * Get the outerHTML for the backing element
   */
  get outerHTML(): string {
    return this.node.outerHTML;
  }

  /**
   * Get the `innerHTML` for the backing element
   */
  get innerHTML(): string {
    return this.node.innerHTML;
  }

  /**
   * Set the `innerHTML` for the backing element
   */
  set innerHTML(value: string) {
    this.node.innerHTML = value;
  }

  /**
   * Get the child elements for the backing element
   */
  get children(): Iterable<Element> {
    return (this.node.children as unknown) as Iterable<Element>;
  }

  /**
   * Add an event listener to the backing element
   */
  addEventListener(event: string, handler: EventListener): void {
    this.node.addEventListener(event, handler);
  }

  /**
   * Remove an event listener from the backing element
   */
  removeEventListener(event: string, handler: EventListener): void {
    this.node.removeEventListener(event, handler);
  }

  /**
   * @access test
   *
   * Get the first element child, apply an optional check, and return it as a
   * `BrowserNode`. This should only be used in tests, so that these utilities
   * can be stripped out in production.
   */
  checkFirstElementChild<S extends SugaryNodeCheck>(sugaryCheck?: S): NodeForSugaryCheck<S> {
    let first = this.node.firstElementChild;

    if (first === null) {
      throw new Error(`firstElementChild unexpectedly returned null`);
    }

    if (sugaryCheck) {
      let check = checkFor(sugaryCheck);
      if (check(first)) {
        return first as NodeForSugaryCheck<S>;
      } else {
        throw new Error(`firstElementChild didn't pass the check`);
      }
    } else {
      return first as NodeForSugaryCheck<S>;
    }
  }
}

/**
 * This class provides utilities for interacting with a Document that was already
 * validated as a browser Document.
 */
class BrowserDocumentUtils extends BrowserNodeUtils<Document, SimpleDocument> {
  createElement(tag: string): SimpleElement {
    return cast(this.node.createElement(tag), 'ELEMENT').simple;
  }

  getElementById(id: string): SimpleElement {
    let queried = this.node.getElementById(id);

    if (queried === null) {
      throw new Error(`element #${id} was not found`);
    } else {
      return cast(queried, 'ELEMENT').simple;
    }
  }
}

interface GenericElementTags {
  HTML: HTMLElement;
  SVG: SVGElement;
  ELEMENT: HTMLElement | SVGElement;
}

interface GenericNodeTags {
  NODE: Node;
}

type GenericNodeTag = keyof GenericNodeTags;

interface BrowserElementTags extends HTMLElementTagNameMap, GenericElementTags {}
type BrowserElementTag = keyof BrowserElementTags;

interface BrowserTags extends BrowserElementTags, GenericNodeTags {}
type BrowserTag = keyof BrowserTags;

type NodeCheck<N extends Node> = (node: Node) => node is N;
type SugaryNodeCheck<K extends BrowserTag = BrowserTag> = NodeCheck<BrowserTags[K]> | K | K[];
type NodeForSugaryCheck<S extends SugaryNodeCheck<BrowserTag>> = S extends NodeCheck<infer N>
  ? N
  : S extends keyof BrowserTags
  ? BrowserTags[S]
  : S extends (keyof BrowserTags)[]
  ? BrowserTags[S[number]]
  : never;

type BrowserNode = Element | Document | DocumentFragment | Text | Comment | Node;

export function cast<S extends SugaryNodeCheck<BrowserElementTag>>(
  node: SimpleDocument | Document
): BrowserDocumentUtils;
export function cast<S extends SugaryNodeCheck<BrowserElementTag>>(
  node: SimpleNode | BrowserNode,
  check: S
): BrowserElementUtils<NodeForSugaryCheck<S>, SimpleElement>;
export function cast<S extends SugaryNodeCheck<GenericNodeTag>>(
  element: SimpleElement | Element,
  check: S
): BrowserNodeUtils<NodeForSugaryCheck<S>>;
export function cast<K extends keyof HTMLElementTagNameMap>(
  element: SimpleElement | Element,
  check: K
): BrowserElementUtils<HTMLElementTagNameMap[K], SimpleElement>;
export function cast(doc: SimpleDocument | Document): BrowserDocumentUtils;
export function cast(doc: SimpleNode | Element | Document): BrowserNodeUtils;
export function cast<S extends SugaryNodeCheck>(
  node: SimpleNode | BrowserNode | null | undefined,
  sugaryCheck?: S
): BrowserNodeUtils | null | undefined {
  if (node === null || node === undefined) {
    return null;
  }

  if (isDocument(node)) {
    if ('getElementById' in node) {
      return new BrowserDocumentUtils(node) as BrowserNodeUtils;
    } else {
      throw new Error(
        `cannot cast a SimpleDocument into a BrowserDocumentUtils outside of a browser environment`
      );
    }
  } else if (isElement(node)) {
    if ('innerHTML' in node) {
      if (sugaryCheck) {
        let check = checkFor(sugaryCheck);
        if (check(node)) {
          return new BrowserElementUtils(node) as BrowserNodeUtils;
        } else {
          throw checkError(`SimpleElement(${node.tagName})`, 'BrowserElementUtils', sugaryCheck);
        }
      } else {
        return new BrowserElementUtils(node);
      }
    } else {
      throw new Error(
        `cannot cast a SimpleElement into an BrowserElementUtils outside of a browser environment`
      );
    }
  } else if (isBrowserNode(node)) {
    return new BrowserNodeUtils(node);
  } else {
    throw new Error(
      `cannot cast a SimpleNode into a NodeElementUtils outside of a browser environment`
    );
  }
}

function checkError(from: string, to: string, check: SugaryNodeCheck): Error {
  return new Error(`cannot cast a ${from} into ${to}, because ${checkDesc(check)} failed`);
}

function isDocument(node: Node | SimpleNode | SimpleDocument): node is Document | SimpleDocument {
  return node.nodeType === NodeType.DOCUMENT_NODE;
}

function isElement(node: Node | SimpleNode | SimpleElement): node is Element | SimpleElement {
  return node.nodeType === NodeType.ELEMENT_NODE;
}

function isBrowserNode(node: Node | SimpleNode): node is Node {
  return typeof document !== undefined && node.ownerDocument === document;
}

function checkFor<S extends SugaryNodeCheck>(check: S): NodeCheck<NodeForSugaryCheck<S>> {
  if (typeof check === 'function') {
    return (el: Node): el is NodeForSugaryCheck<S> =>
      (check as NodeCheck<BrowserTags[BrowserTag]>)(el);
  } else if (typeof check === 'string') {
    return (node: Node): node is NodeForSugaryCheck<S> =>
      stringCheckNode(node, check as BrowserTag);
  } else if (Array.isArray(check)) {
    return (node: Node): node is NodeForSugaryCheck<S> =>
      check.some((c) => stringCheckNode(node, c as BrowserTag));
  } else {
    throw unreachable();
  }
}

function stringCheckNode<S extends BrowserTag>(node: Node, check: S): node is BrowserTags[S] {
  switch (check) {
    case 'NODE':
      return true;
    case 'HTML':
      return node instanceof HTMLElement;
    case 'SVG':
      return node instanceof SVGElement;
    case 'ELEMENT':
      return node instanceof Element;
    default:
      if (check.toUpperCase() === check) {
        throw new Error(`BUG: this code is missing handling for a generic node type`);
      }
      return node instanceof Element && node.tagName.toLowerCase() === check;
  }
}

function checkDesc(check: SugaryNodeCheck): string {
  if (typeof check === 'string') {
    return `(tagName === ${check})`;
  } else if (Array.isArray(check)) {
    return `(tagName in ${check.join(' | ')})`;
  } else {
    return `(${check.toString()})`;
  }
}
