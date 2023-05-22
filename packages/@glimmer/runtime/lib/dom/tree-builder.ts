import type {
  AttributeRef,
  BlockBounds,
  BlockBoundsRef,
  DOMTreeBuilder,
  DebugDOMTreeBuilder,
  ElementRef,
  MinimalChild,
  MinimalCursor,
  MinimalDocument,
  MinimalDocumentFragment,
  MinimalElement,
  MinimalParent,
  PresentStack,
  RuntimeBlockBounds,
} from '@glimmer/interfaces';
import {
  INSERT_BEFORE_END,
  NS_HTML,
  unwrap,
  assert,
  PresentStack as PresentStackImpl,
} from '@glimmer/util';

function getBoundsNodes(bounds: BlockBounds): [start: MinimalChild, end: MinimalChild] {
  let { start, end } = bounds;
  let startNode = 'nodeType' in start ? start : getBoundsNodes(unwrap(start.current))[0];
  let endNode = 'nodeType' in end ? end : getBoundsNodes(unwrap(end.current))[1];

  return [startNode as MinimalChild, endNode as MinimalChild];
}

export function clearBlockBounds(bounds: RuntimeBlockBounds): ChildNode | null {
  let [start, end] = getBoundsNodes(bounds) as [ChildNode, ChildNode];
  let next = end.nextSibling;

  let range = new Range();
  range.setStartBefore(start);
  range.setEndAfter(end);

  range.deleteContents();

  return next;
}

type Block = [
  depth: number,
  block: BlockBoundsRef,
  start: MinimalChild | BlockBoundsRef | undefined,
  end: MinimalChild | BlockBoundsRef | undefined
];

const DEPTH = 0;
const BLOCK_REF = 1;
const START_NODE = 2;
const END_NODE = 3;

export class TreeConstruction implements DOMTreeBuilder {
  static _forContext_(parent: MinimalElement) {
    return new TreeConstruction(parent.ownerDocument, [parent, null, null], null);
  }

  static _forCursor_(cursor: MinimalCursor) {
    return new TreeConstruction(cursor[PARENT_ELEMENT].ownerDocument, cursor, null);
  }

  static _resume_(block: RuntimeBlockBounds): TreeConstruction {
    let parentNode = block.parent;
    let nextSibling = clearBlockBounds(block);

    let tree = new TreeConstruction(
      parentNode.ownerDocument as MinimalDocument,
      [parentNode as MinimalParent, nextSibling as MinimalChild, null],
      null
    );

    // tree.#blocks.push(tree.#blocks.current);

    return tree;
  }

  #document: MinimalDocument;
  #cursor: MinimalCursor;
  #buffer: ElementBuffer | null;

  declare debug?: DebugDOMTreeBuilder;

  /**
   * The current element depth of the tree. Nodes are only added to the bounds of the
   * current block if they have the same element depth as the block.
   */
  #depth = 0;
  #blocks: PresentStack<Block> = PresentStackImpl.initial([
    0,
    { current: null },
    undefined,
    undefined,
  ]);

  constructor(document: MinimalDocument, cursor: MinimalCursor, buffer: ElementBuffer | null) {
    this.#document = document;
    this.#cursor = cursor;

    this.#buffer = buffer;

    if (import.meta.env.DEV) {
      Object.defineProperty(this, 'debug', {
        configurable: true,
        get: () => {
          return {
            cursor: this.#cursor,
            constructing: this.#buffer,
            finalize: () => {
              assert(this.#blocks.size === 1, `BUG: unbalanced tree (${this.#blocks.size})`);
            },
          } satisfies DebugDOMTreeBuilder;
        },
      });
    }
  }

  get _constructing_(): ElementRef {
    return unwrap(this.#buffer).ref;
  }

  html(html: string): [MinimalChild | null, MinimalChild | null] {
    let [start, end] = insertHTML(this.#cursor, html);

    if (start === null || end === null) {
      let child = this.comment('');
      return [child, child];
    }

    this.#addChild([start, end]);
    return [start, end];
  }

  child(child: MinimalChild): MinimalChild {
    this.#addChild(insert(this.#cursor, child));
    return child;
  }

  get _currentElement_(): MinimalElement | null {
    return this.#cursor[PARENT_ELEMENT] as MinimalElement | null;
  }

  recover(): void {
    this.#blocks = PresentStackImpl.initial([0, { current: null }, undefined, undefined]);
  }

  #addChild([start, end]: [
    start: MinimalChild | BlockBoundsRef | null,
    end: MinimalChild | BlockBoundsRef | null
  ]): void {
    let current = this.#blocks.current;

    if (current) {
      let blockDepth = current[DEPTH];

      if (this.#depth !== blockDepth) return;

      current[START_NODE] ??= start ?? undefined;
      current[END_NODE] = end ?? undefined;
    }
  }

  startBlock(): BlockBoundsRef {
    let ref = { current: null };
    this.#blocks.push([this.#depth, ref, undefined, undefined]);
    return ref;
  }

  return(): BlockBoundsRef {
    let current = unwrap(this.#blocks.current);
    let [_depth, ref, start, end] = current;

    if (start === undefined) {
      this.comment('');
      return this.endBlock();
    }

    ref.current = {
      parent: this.#cursor[PARENT_ELEMENT],
      start: unwrap(start),
      end: unwrap(end),
    } as BlockBounds;

    return ref;
  }

  endBlock(): BlockBoundsRef {
    let current = unwrap(this.#blocks.current);
    let [_depth, ref, start, end] = current;

    if (start === undefined) {
      this.comment('');
      return this.endBlock();
    }

    ref.current = {
      parent: this.#cursor[PARENT_ELEMENT],
      start: unwrap(start),
      end: unwrap(end),
    } as BlockBounds;

    this.#blocks.pop();
    this.#addChild([ref, ref]);

    return ref;
  }

  text(text: string) {
    let node = this.#document.createTextNode(text);
    insert(this.#cursor, node);

    this.#addChild([node, node]);
    return node;
  }

  comment(data: string) {
    let node = this.#document.createComment(data);
    insert(this.#cursor, node);
    this.#addChild([node, node]);
    return node;
  }

  startElement(tag: string) {
    this.#buffer = ElementBuffer(tag);
  }

  addAttr(attributeName: string, attributeValue: string | boolean | undefined): AttributeRef {
    return unwrap(this.#buffer).attr(attributeName, attributeValue);
  }

  flushElement() {
    let buffer = unwrap(this.#buffer);
    let child = buffer.flush(this.#cursor);
    this.#addChild([child, child]);
    this.#depth++;
    this.#cursor = [child, null, this.#cursor];
    return child;
  }

  endElement() {
    this.#depth--;
    this.#cursor = unwrap(this.#cursor[PARENT_CURSOR]);
  }
}

const ELEMENT_NODE = 1;
type ELEMENT_NODE = typeof ELEMENT_NODE;
const DOCUMENT_FRAGMENT_NODE = 11;
type DOCUMENT_FRAGMENT_NODE = typeof DOCUMENT_FRAGMENT_NODE;

function insert(
  cursor: MinimalCursor,
  child: MinimalChild
): [MinimalChild | null, MinimalChild | null] {
  if (child.nodeType === DOCUMENT_FRAGMENT_NODE) {
    return insertDocumentFragment(cursor, child as MinimalDocumentFragment);
  }

  cursor[PARENT_ELEMENT].insertBefore(child, cursor[NEXT_SIBLING]);

  return [child, child];
}

function insertDocumentFragment(
  cursor: MinimalCursor,
  child: MinimalDocumentFragment
): [MinimalChild, MinimalChild] {
  // If the document fragment is empty, insert a comment to represent it. In a future
  // render, the document fragment may have contents.
  if (child.firstChild === null) {
    child.insertBefore(child.ownerDocument.createComment(''), null);
  }

  let first = unwrap(child.firstChild);
  let last = unwrap(child.lastChild);

  cursor[PARENT_ELEMENT].insertBefore(child, cursor[NEXT_SIBLING]);

  return [first, last];
}

function insertHTML(
  cursor: MinimalCursor,
  html: string
): [MinimalChild | null, MinimalChild | null] {
  let parent = cursor[PARENT_ELEMENT];
  let next = cursor[NEXT_SIBLING];

  if (next === null && parent.nodeType === ELEMENT_NODE) {
    let last = (parent as MinimalElement).lastChild;
    (parent as MinimalElement).insertAdjacentHTML(INSERT_BEFORE_END, html);
    return last === null
      ? [parent.firstChild, parent.lastChild]
      : [last.nextSibling, parent.lastChild];
  }

  let template = unwrap(parent.ownerDocument).createElementNS(NS_HTML, 'template');
  // eslint-disable-next-line unicorn/prefer-modern-dom-apis
  parent.insertBefore(template, next);
  let range = new Range();
  range.selectNode(template as unknown as Node);
  let fragment = range.createContextualFragment(html) as unknown as MinimalDocumentFragment;
  let first = fragment.firstChild;
  let last = fragment.lastChild;
  template.replaceWith(fragment);
  return [first, last];
}

export const PARENT_ELEMENT = 0;
export const NEXT_SIBLING = 1;
export const PARENT_CURSOR = 2;

interface ElementBuffer {
  readonly ref: ElementRef;
  attr: (attributeName: string, attributeValue?: string | boolean) => AttributeRef;
  flush: (parent: MinimalCursor) => MinimalElement;
}

function ElementBuffer(tag: string): ElementBuffer {
  let buffer = `<${tag}`;
  let refs: AttributeRef[] = [];
  let elementRef: ElementRef = {
    current: null,
  };

  return {
    get ref(): ElementRef {
      return elementRef;
    },

    attr(qualifiedName: string, attributeValue: unknown) {
      let ref: AttributeRef = [qualifiedName, null];
      refs.push(ref);
      attributeValue = specialAttributeValue(tag, qualifiedName, attributeValue);

      if (attributeValue === false) return ref;
      if (attributeValue === true) attributeValue = '';

      buffer += ` ${qualifiedName}="${attributeValue}"`;
      return ref;
    },

    flush(cursor: MinimalCursor): MinimalElement {
      let [el] = insertHTML(cursor, `${buffer}>`) as [Element, Element];
      elementRef.current = el;
      for (let ref of refs) ref[1] = el;
      return el as MinimalElement;
    },
  };
}

function specialAttributeValue(
  tagName: string,
  qualifiedName: string,
  attributeValue: unknown
): string | false {
  let normalized = normalizeAttributeValue(attributeValue);

  if (normalized === null) {
    normalized = specialCases(tagName, qualifiedName, attributeValue);
  }

  return normalized;
}

export function updateAttributeRef(attributeRef: AttributeRef, value: unknown) {
  let [qualifiedName, element] = attributeRef;

  let normalized = specialAttributeValue(unwrap(element).tagName, qualifiedName, value);

  if (normalized === false) {
    unwrap(element).removeAttribute(qualifiedName);
  } else {
    unwrap(element).setAttribute(qualifiedName, normalized);
  }
}

function normalizeAttributeValue(value: unknown): string | false | null {
  if (value === false) return false;
  if (value === true) return '';

  return null;
}

/**
 * These special cases are probably not necessary but they avoid breaking the tests during refactoring.
 */
function specialCases(tagName: string, qualifiedName: string, value: unknown): string | false {
  switch (tagName.toUpperCase()) {
    case 'INPUT':
      switch (qualifiedName) {
        case 'disabled':
          return value == null ? false : '';
        case 'value':
          if (value == null) return '';
      }
  }

  return value === null || value === undefined ? false : toString(value);
}

function toString(value: unknown) {
  if (value && typeof value === 'object' && typeof value.toString !== 'function') return '';

  return String(value);
}
