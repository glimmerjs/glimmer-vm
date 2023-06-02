import type { Maybe, Nullable } from '../core';
import type { ElementOperations, Environment, ModifierInstance } from '../runtime';
import type { Stack } from '../stack';
import type {
  Bounds,
  BrowserDOMEnvironment,
  CommentFor,
  Cursor,
  DOMEnvironment,
  NodeFor,
  TextFor,
} from './bounds';
import type { GlimmerTreeChanges, GlimmerTreeConstruction } from './changes';
import type { SimpleDocumentFragment } from './simple';
import type { BrowserTreeBuilderInterface, ServerTreeBuilderInterface } from './tree-builder';

export interface LiveBlock<E extends DOMEnvironment = DOMEnvironment> extends Bounds<E> {
  openElement(element: E['element']): void;
  closeElement(): void;
  didAppendNode(node: E['child']): void;
  didAppendBounds(bounds: Bounds<E>): void;
  finalize(stack: ElementBuilder<E>): void;
}

export interface SimpleLiveBlock<E extends DOMEnvironment = DOMEnvironment> extends LiveBlock<E> {
  parentElement(): E['element'];
  firstNode(): E['child'];
  lastNode(): E['child'];
}

export type RemoteLiveBlock<E extends DOMEnvironment = DOMEnvironment> = SimpleLiveBlock<E>;

export interface UpdatableBlock extends SimpleLiveBlock<BrowserDOMEnvironment> {
  reset(environment: Environment): Nullable<ChildNode>;
}

export interface DOMStack<E extends DOMEnvironment = DOMEnvironment> {
  pushRemoteElement(
    element: E['element'],
    guid: string,
    insertBefore: Maybe<NodeFor<E>>
  ): Nullable<RemoteLiveBlock<E>>;
  popRemoteElement(): void;
  popElement(): void;
  openElement(tag: string, _operations?: ElementOperations): E['element'];
  flushElement(modifiers: Nullable<ModifierInstance[]>): void;
  appendText(string: string): TextFor<E>;
  appendComment(string: string): CommentFor<E>;

  appendDynamicHTML(value: string): void;
  appendDynamicText(value: string): TextFor<E>;
  appendDynamicFragment(value: NodeFor<E, SimpleDocumentFragment | DocumentFragment>): void;
  appendDynamicNode(value: NodeFor<E>): void;

  setStaticAttribute(name: string, value: string, namespace: Nullable<string>): void;
  setDynamicAttribute(
    name: string,
    value: unknown,
    isTrusting: boolean,
    namespace: Nullable<string>
  ): AttributeOperation<E>;

  closeElement(): Nullable<ModifierInstance[]>;
}

export interface TreeOperations<E extends DOMEnvironment = DOMEnvironment> {
  __openElement(tag: string): E['element'];
  __flushElement(parent: E['element'], constructing: E['element']): void;
  __openBlock(): void;
  __closeBlock(): void;
  __appendText(text: string): TextFor<E>;
  __appendComment(string: string): CommentFor<E>;
  __appendNode(node: E['child']): E['child'];
  __appendHTML(html: string): Bounds<E>;
  __setAttribute(name: string, value: string, namespace: Nullable<string>): void;
  __setProperty(name: string, value: unknown): void;
}

interface DebugElementBuilder<E extends DOMEnvironment = DOMEnvironment> {
  getCursors: () => Stack<Cursor<E>>;
}

export interface ElementBuilder<E extends DOMEnvironment = DOMEnvironment>
  extends Cursor<E>,
    DOMStack<E>,
    TreeOperations {
  nextSibling: Nullable<E['child']>;
  _dom_: GlimmerTreeConstruction<E>;
  _updateOperations_: GlimmerTreeChanges;
  _constructing_: Nullable<E['element']>;
  _debug_?: DebugElementBuilder<E>;
  element: E['element'];

  hasBlocks: boolean;
  debugBlocks(): LiveBlock<E>[];

  pushSimpleBlock(): LiveBlock<E>;
  pushUpdatableBlock(): UpdatableBlock;
  pushBlockList(list: Bounds[]): LiveBlock<E>;
  popBlock(): LiveBlock<E>;

  didAppendBounds(bounds: Bounds<E>): void;
}

export interface AttributeCursor {
  tag: string;
  /** The specified attribute name */
  name: string;
  /** The normalized attribute name (e.g. ') */
  normalized: string;
}

export interface AttributeOperation {
  attribute: AttributeCursor;
  server(dom: ServerTreeBuilderInterface, value: unknown): void;
  client(dom: BrowserTreeBuilderInterface, value: unknown): void;
  rehydrate(_dom: BrowserTreeBuilderInterface, _element: Element, _value: unknown): void;
  update(element: Element, value: unknown): void;
}
