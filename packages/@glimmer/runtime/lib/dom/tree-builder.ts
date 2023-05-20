/* eslint-disable unicorn/prefer-dom-node-append */
import type { AttrNamespace, ElementNamespace, Nullable } from '@glimmer/interfaces';
import { INSERT_BEFORE_END, unwrap } from '@glimmer/util';

export class TreeConstruction {
  static _forContext_(parent: MinimalElement) {
    return new TreeConstruction(parent.ownerDocument, parent, null);
  }

  #document: MinimalDocument;
  #parent: MinimalElement;
  #buffer: ElementBuffer | null;

  constructor(document: MinimalDocument, parent: MinimalElement, buffer: ElementBuffer | null) {
    this.#document = document;
    this.#parent = parent;
    this.#buffer = buffer;
  }

  text(text: string) {
    let node = this.#document.createTextNode(text);
    this.#parent.appendChild(node);
    return node;
  }

  comment(data: string) {
    let node = this.#document.createComment(data);
    this.#parent.appendChild(node);
    return node;
  }

  startElement(tag: string) {
    this.#buffer = ElementBuffer(tag);
  }

  addAttr(attributeName: string, attributeValue: string | boolean = true) {
    if (attributeValue === true) attributeValue = '';
    if (attributeValue === false) return;

    unwrap(this.#buffer).attr(attributeName, attributeValue);
  }

  flushElement() {
    let buffer = unwrap(this.#buffer);
    return buffer.flush(this.#parent);
  }

  endElement() {
    this.#parent = this.#parent.parentNode as MinimalElement;
  }
}

const DOCUMENT_NODE = 9;
type DOCUMENT_NODE = typeof DOCUMENT_NODE;
const ELEMENT_NODE = 1;
type ELEMENT_NODE = typeof ELEMENT_NODE;
const DOCUMENT_FRAGMENT_NODE = 11;
type DOCUMENT_FRAGMENT_NODE = typeof DOCUMENT_FRAGMENT_NODE;

interface MinimalDocument {
  readonly nodeType: DOCUMENT_NODE;
  readonly ownerDocument: MinimalDocument;

  createElementNS(ns: Nullable<string>, tag: string): MinimalElement;
  createTextNode(text: string): MinimalText;
  createComment(data: string): MinimalComment;

  appendChild(newChild: Child): void;
}

interface MinimalText {
  readonly data: string;
}

interface MinimalComment {
  readonly data: string;
}

interface MinimalElement {
  readonly nodeType: ELEMENT_NODE;
  readonly namespaceURI: ElementNamespace | null;
  readonly ownerDocument: MinimalDocument;
  readonly lastChild: Child | null;
  readonly parentNode: MinimalElement | null;
  insertAdjacentHTML(position: 'beforeend', html: string): void;
  appendChild(newChild: Child): void;
  setAttribute(name: string, value: string): void;
  setAttributeNS(namespace: AttrNamespace, name: string, value: string): void;
}

interface _MinimalTemplateElement extends MinimalElement {
  readonly content: MinimalDocumentFragment;
  innerHTML: string;
}

interface MinimalDocumentFragment {
  readonly nodeType: DOCUMENT_FRAGMENT_NODE;
}

type Child = MinimalText | MinimalComment | MinimalDocumentFragment;

interface ElementBuffer {
  attr: (attributeName: string, attributeValue?: string | boolean) => void;
  flush: (parent: MinimalElement) => MinimalElement;
}

function ElementBuffer(tag: string): ElementBuffer {
  let buffer = `<${tag}>`;

  return {
    attr(attributeName: string, attributeValue: string | boolean = '') {
      if (attributeValue === false) return;
      if (attributeValue === true) attributeValue = '';

      buffer += ` ${attributeName}="${attributeValue}"`;
    },

    flush(parent: MinimalElement): MinimalElement {
      parent.insertAdjacentHTML(INSERT_BEFORE_END, `${buffer}</${tag}>`);
      return parent.lastChild as unknown as MinimalElement;
    },
  };
}
