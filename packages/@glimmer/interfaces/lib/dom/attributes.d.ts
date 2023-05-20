import type { Maybe, Nullable } from '../core';
import type { ElementOperations, Environment, ModifierInstance } from '../runtime';
import type { Stack } from '../stack';
import type { Bounds, Cursor, DOMEnvironment } from './bounds';
import type { GlimmerTreeChanges, GlimmerTreeConstruction } from './changes';
import type {
  AttrNamespace as AttributeNamespace,
  SimpleComment,
  SimpleDocumentFragment,
  SimpleElement,
  SimpleNode,
  SimpleText,
} from './simple';

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

export type RemoteLiveBlock = SimpleLiveBlock;

export interface UpdatableBlock extends SimpleLiveBlock {
  reset(environment: Environment): Nullable<ChildNode>;
}

export interface DOMStack<E extends DOMEnvironment = DOMEnvironment> {
  pushRemoteElement(
    element: SimpleElement,
    guid: string,
    insertBefore: Maybe<SimpleNode>
  ): Nullable<RemoteLiveBlock>;
  popRemoteElement(): void;
  popElement(): void;
  openElement(tag: string, _operations?: ElementOperations): SimpleElement;
  flushElement(modifiers: Nullable<ModifierInstance[]>): void;
  appendText(string: string): SimpleText;
  appendComment(string: string): SimpleComment;

  appendDynamicHTML(value: string): void;
  appendDynamicText(value: string): SimpleText;
  appendDynamicFragment(value: SimpleDocumentFragment): void;
  appendDynamicNode(value: SimpleNode): void;

  setStaticAttribute(name: string, value: string, namespace: Nullable<string>): void;
  setDynamicAttribute(
    name: string,
    value: unknown,
    isTrusting: boolean,
    namespace: Nullable<string>
  ): AttributeOperation<E>;

  closeElement(): Nullable<ModifierInstance[]>;
}

export interface TreeOperations {
  __openElement(tag: string): SimpleElement;
  __flushElement(parent: SimpleElement, constructing: SimpleElement): void;
  __openBlock(): void;
  __closeBlock(): void;
  __appendText(text: string): SimpleText;
  __appendComment(string: string): SimpleComment;
  __appendNode(node: SimpleNode): SimpleNode;
  __appendHTML(html: string): Bounds;
  __setAttribute(name: string, value: string, namespace: Nullable<string>): void;
  __setProperty(name: string, value: unknown): void;
}

interface DebugElementBuilder<E extends DOMEnvironment = DOMEnvironment> {
  getCursors: () => Stack<Cursor<E>>;
}

export interface ElementBuilder<E extends DOMEnvironment = DOMEnvironment>
  extends Cursor<E>,
    DOMStack,
    TreeOperations {
  nextSibling: Nullable<E['child']>;
  _dom_: GlimmerTreeConstruction;
  _updateOperations_: GlimmerTreeChanges;
  _constructing_: Nullable<E['element']>;
  _debug_?: DebugElementBuilder<E>;
  element: E['element'];

  hasBlocks: boolean;
  debugBlocks(): LiveBlock[];

  pushSimpleBlock(): LiveBlock;
  pushUpdatableBlock(): UpdatableBlock;
  pushBlockList(list: Bounds[]): LiveBlock;
  popBlock(): LiveBlock;

  didAppendBounds(bounds: Bounds): void;
}

export interface AttributeCursor<E extends DOMEnvironment = DOMEnvironment> {
  element: E['element'];
  name: string;
  namespace: Nullable<AttributeNamespace>;
}

export interface AttributeOperation<E extends DOMEnvironment = DOMEnvironment> {
  attribute: AttributeCursor;
  set(dom: ElementBuilder<E>, value: unknown, environment: Environment): void;
  update(value: unknown, environment: Environment): void;
}
