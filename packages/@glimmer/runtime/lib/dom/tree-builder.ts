import { registerDestructor } from '@glimmer/destroyable';
import type {
  IREF_ELEMENT,
  AttributeRef,
  BlockBounds,
  BlockBoundsRef,
  DebugDOMTreeBuilder,
  ElementRef,
  MinimalChild,
  MinimalInternalCursor,
  MinimalDocument,
  MinimalDocumentFragment,
  MinimalElement,
  MinimalParent,
  PresentStack,
  RuntimeBlockBounds,
  MinimalCursor,
  Destroyable,
  BrowserTreeBuilderInterface,
  ElementBuffer,
  ServerTreeBuilderInterface,
  PropRef,
  Nullable,
} from '@glimmer/interfaces';
import {
  INSERT_BEFORE_END,
  NS_HTML,
  unwrap,
  assert,
  PresentStack as PresentStackImpl,
} from '@glimmer/util';

export const REF_ELEMENT: IREF_ELEMENT = 1;

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

class CurrentElement {
  readonly #tag: string;
  readonly #parent: CurrentElement | null;

  constructor(tag: string, parent: CurrentElement | null) {
    this.#tag = tag;
    this.#parent = parent;
  }

  child(tag: string) {
    return new CurrentElement(tag, this);
  }

  get tag() {
    return this.#tag;
  }

  end(): CurrentElement | null {
    return this.#parent;
  }
}

export const voidMap: {
  [tagName: string]: boolean;
} = Object.create(null);

let voidTagNames =
  'area base br col command embed hr img input keygen link meta param source track wbr';
for (let tagName of voidTagNames.split(' ')) {
  voidMap[tagName] = true;
}

export class ServerTreeBuilder implements ServerTreeBuilderInterface {
  readonly type = 'server';

  #buffer = '';
  #element: CurrentElement | null = null;

  _flush_(): string {
    let buffer = this.#buffer;
    this.#buffer = '';
    return buffer;
  }

  get _currentTag_(): Nullable<string> {
    return this.#element?.tag ?? null;
  }

  startBlock(): void {}
  endBlock(): void {}
  return(): void {}
  text(text: string): void {
    this.#buffer += escapeHTML(text);
  }
  html(html: string): void {
    this.#buffer += html;
  }
  comment(data: string): void {
    this.#buffer += `<!--${data}-->`;
  }
  startElement(tag: string): void {
    this.#buffer += `<${tag}`;
    this.#element = new CurrentElement(tag, this.#element);
  }
  addAttr(attributeName: string, attributeValue: unknown): void {
    if (attributeValue == null || attributeValue === false) return;
    if (attributeValue === true) attributeValue = '';
    this.#buffer += attributeValue ? ` ${attributeName}="${attributeValue}"` : ` ${attributeName}`;
  }
  flushElement(): void {
    this.#buffer += '>';
  }
  endElement(): void {
    let element = unwrap(this.#element);
    let tag = element.tag;
    this.#element = element.end();

    if (voidMap[tag]) return;
    this.#buffer += `</${tag}>`;
  }
  recover(): void {
    throw new Error('Method not implemented.');
  }
}

function escapeHTML(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export class BrowserTreeBuilder implements BrowserTreeBuilderInterface {
  static _forContext_(parent: MinimalElement) {
    return new BrowserTreeBuilder(parent.ownerDocument, [parent, null, null], null);
  }

  static _forCursor_(cursor: MinimalInternalCursor) {
    return new BrowserTreeBuilder(cursor[PARENT_ELEMENT].ownerDocument, cursor, null);
  }

  static _resume_(block: RuntimeBlockBounds): BrowserTreeBuilder {
    let parentNode = block.parent;
    let nextSibling = clearBlockBounds(block);

    let tree = new BrowserTreeBuilder(
      parentNode.ownerDocument as MinimalDocument,
      [parentNode as MinimalParent, nextSibling as MinimalChild, null],
      null
    );

    return tree;
  }

  readonly type = 'browser';

  #document: MinimalDocument;
  #cursor: MinimalInternalCursor;
  #buffer: BrowserElementBuffer | null;

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

  constructor(
    document: MinimalDocument,
    cursor: MinimalInternalCursor,
    buffer: BrowserElementBuffer | null
  ) {
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

  get _root_(): MinimalElement {
    return this.#cursor[0];
  }

  get _currentTag_(): Nullable<string> {
    return this.#buffer?.tag ?? null;
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
    this.#buffer = BrowserElementBuffer(tag);
  }

  addAttr(attributeName: string, attributeValue: string | boolean | undefined): AttributeRef {
    return unwrap(this.#buffer).attr(attributeName, attributeValue);
  }

  addProp(propName: string, insert: (element: Element) => void): PropRef {
    return unwrap(this.#buffer).prop(propName, insert);
  }

  flushElement() {
    let buffer = unwrap(this.#buffer);
    let html = buffer.flush();

    let [child] = insertHTML(this.#cursor, html) as [MinimalElement, MinimalElement];
    buffer.initialize(child as Element);

    this.#addChild([child, child]);
    this.#depth++;
    this.#cursor = [child, null, this.#cursor];
    return child;
  }

  endElement(): MinimalElement {
    this.#depth--;
    let element = unwrap(this.#cursor[PARENT_ELEMENT]);
    this.#cursor = unwrap(this.#cursor[PARENT_CURSOR]);
    return element as MinimalElement;
  }

  startInElement([parent, next]: MinimalCursor): void {
    if (next === undefined && parent.firstChild) {
      parent.innerHTML = '';
    }

    this.#cursor = [parent, next, this.#cursor];
    this.#depth++;
    this.startBlock();
  }

  endInElement(): Destroyable {
    let block = this.endBlock();
    this.endElement();
    let destroyable = {};

    registerDestructor(destroyable, () => {
      if (block.current) clearBlockBounds(block.current as RuntimeBlockBounds);
    });

    return destroyable;
  }
}

const ELEMENT_NODE = 1;
type ELEMENT_NODE = typeof ELEMENT_NODE;
const DOCUMENT_FRAGMENT_NODE = 11;
type DOCUMENT_FRAGMENT_NODE = typeof DOCUMENT_FRAGMENT_NODE;

function insert(
  cursor: MinimalInternalCursor,
  child: MinimalChild
): [MinimalChild | null, MinimalChild | null] {
  if (child.nodeType === DOCUMENT_FRAGMENT_NODE) {
    return insertDocumentFragment(cursor, child as MinimalDocumentFragment);
  }

  cursor[PARENT_ELEMENT].insertBefore(child, cursor[NEXT_SIBLING]);

  return [child, child];
}

function insertDocumentFragment(
  cursor: MinimalInternalCursor,
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
  cursor: MinimalInternalCursor,
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

interface BrowserElementBuffer extends ElementBuffer {
  readonly ref: ElementRef;
  readonly tag: string;
  attr: (attributeName: string, attributeValue?: string | boolean) => AttributeRef;
  prop: (propName: string, insert: (element: Element) => void) => PropRef;

  initialize: (element: Element) => void;
}

function BrowserElementBuffer(tag: string): BrowserElementBuffer {
  let buffer = `<${tag}`;
  let refs: AttributeRef[] = [];
  let props: PropRef[] = [];
  let elementRef: ElementRef = {
    current: null,
  };

  return {
    tag,
    get ref(): ElementRef {
      return elementRef;
    },

    initialize: (element: Element): void => {
      elementRef.current = element;
      for (let ref of refs) ref[REF_ELEMENT] = element;
      for (let prop of props) {
        prop[REF_ELEMENT] = element;
        let propValue = prop[2];
        propValue(element);
      }
    },

    attr(qualifiedName: string, attributeValue: unknown) {
      let ref: AttributeRef = [qualifiedName, null];
      refs.push(ref);
      attributeValue = specialAttributeValue(tag, qualifiedName, attributeValue);

      if (attributeValue === false || attributeValue === null) return ref;
      if (attributeValue === true) attributeValue = '';

      buffer += ` ${qualifiedName}="${attributeValue}"`;
      return ref;
    },

    prop(propName: string, insert: (element: Element) => void) {
      let ref: PropRef = [propName, null, insert];
      props.push(ref);
      return ref;
    },

    flush(): string {
      return `${buffer}>`;
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
