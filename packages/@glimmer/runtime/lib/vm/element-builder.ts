/* eslint-disable unicorn/prefer-dom-node-remove */
import { destroy, registerDestructor } from '@glimmer/destroyable';
import type {
  AttrNamespace,
  Bounds,
  BrowserDOMEnvironment,
  Cursor,
  DebugElementBuilder,
  ElementBuilder,
  ElementOperations,
  Environment,
  GlimmerTreeChanges,
  GlimmerTreeConstruction,
  LiveBlock,
  Maybe,
  ModifierInstance,
  Nullable,
  SimpleComment,
  SimpleDocumentFragment,
  SimpleElement,
  SimpleNode,
  SimpleText,
  UpdatableBlock,
  UpdatableBounds,
} from '@glimmer/interfaces';
import { assert, castToSimple, expect, Stack } from '@glimmer/util';

import {
  clear,
  ConcreteBounds,
  CursorImpl,
  SingleNodeBounds,
  type DOMEnvironment,
} from '../bounds';
import { type DynamicAttribute, dynamicAttribute } from './attributes/dynamic';

export type FirstNode = Pick<UpdatableBounds, 'firstNode'>;
export type LastNode = Pick<UpdatableBounds, 'lastNode'>;

function First(node: ChildNode): FirstNode {
  return {
    firstNode: () => node,
  };
}

function Last(node: ChildNode): LastNode {
  return {
    lastNode: () => node,
  };
}

export class NewElementBuilder<E extends DOMEnvironment = DOMEnvironment>
  implements ElementBuilder<E>
{
  public _dom_: GlimmerTreeConstruction;
  public _updateOperations_: GlimmerTreeChanges;
  public _constructing_: Nullable<E['element']> = null;
  public operations: Nullable<ElementOperations> = null;
  private env: Environment;

  readonly #cursors = new Stack<Cursor<E>>();
  private modifierStack = new Stack<Nullable<ModifierInstance[]>>();
  private blockStack = new Stack<LiveBlock<E>>();

  static forInitialRender<E extends DOMEnvironment>(
    environment: Environment,
    cursor: CursorImpl<E>
  ) {
    return new this(environment, cursor.element, cursor.nextSibling).initialize();
  }

  static resume(
    environment: Environment,
    block: UpdatableBlock
  ): NewElementBuilder<BrowserDOMEnvironment> {
    let parentNode = block.parentElement();
    let nextSibling = block.reset(environment);

    let stack = new this(environment, castToSimple(parentNode), nextSibling).initialize();
    stack.pushLiveBlock(block);

    return stack;
  }

  constructor(
    environment: Environment,
    parentNode: SimpleElement | Element,
    nextSibling: Nullable<SimpleNode | ChildNode>
  ) {
    this.pushElement(parentNode, nextSibling);

    this.env = environment;
    this._dom_ = environment.getAppendOperations();
    this._updateOperations_ = environment.getDOM();

    if (import.meta.env.DEV) {
      Object.defineProperty(this, '_debug_', {
        enumerable: true,
        configurable: true,
        writable: false,
        value: {
          getCursors: () => this.#cursors,
        } satisfies DebugElementBuilder<E>,
      });
    }
  }

  protected get _currentCursor_(): Nullable<Cursor<E>> {
    return this.#cursors.current;
  }

  protected _pushCursor_(cursor: Cursor<E>) {
    this.#cursors.push(cursor);
  }

  protected initialize(): this {
    this.pushSimpleBlock();
    return this;
  }

  debugBlocks(): LiveBlock[] {
    return this.blockStack.toArray();
  }

  get element(): E['element'] {
    return this.#cursors.current!.element;
  }

  get nextSibling(): Nullable<E['child']> {
    return this.#cursors.current!.nextSibling;
  }

  get hasBlocks() {
    return this.blockStack.size > 0;
  }

  protected block(): LiveBlock {
    return expect(this.blockStack.current, 'Expected a current live block');
  }

  popElement() {
    this.#cursors.pop();
    expect(this.#cursors.current, "can't pop past the last element");
  }

  pushSimpleBlock(): LiveBlock {
    return this.pushLiveBlock(new SimpleLiveBlock(this.element));
  }

  pushUpdatableBlock(): UpdatableBlockImpl<E> {
    return this.pushLiveBlock(new UpdatableBlockImpl(this.element));
  }

  pushBlockList(list: LiveBlock[]): LiveBlockList {
    return this.pushLiveBlock(new LiveBlockList(this.element, list));
  }

  protected pushLiveBlock<T extends LiveBlock>(block: T, isRemote = false): T {
    let current = this.blockStack.current;

    if (current !== null && !isRemote) {
      current.didAppendBounds(block);
    }

    this.__openBlock();
    this.blockStack.push(block);
    return block;
  }

  popBlock(): LiveBlock {
    this.block().finalize(this);
    this.__closeBlock();
    return expect(this.blockStack.pop(), 'Expected popBlock to return a block');
  }

  __openBlock(): void {}
  __closeBlock(): void {}

  // todo return seems unused
  openElement(tag: string): SimpleElement {
    let element = this.__openElement(tag);
    this._constructing_ = element;

    return element;
  }

  __openElement(tag: string): SimpleElement {
    return this._dom_.createElement(tag, this.element);
  }

  flushElement(modifiers: Nullable<ModifierInstance[]>) {
    let parent = this.element;
    let element = expect(
      this._constructing_,
      `flushElement should only be called when constructing an element`
    );

    this.__flushElement(parent, element);

    this._constructing_ = null;
    this.operations = null;

    this.pushModifiers(modifiers);
    this.pushElement(element, null);
    this.didOpenElement(element);
  }

  __flushElement(parent: SimpleElement, constructing: SimpleElement) {
    this._dom_.insertBefore(parent, constructing, this.nextSibling);
  }

  closeElement(): Nullable<ModifierInstance[]> {
    this.willCloseElement();
    this.popElement();
    return this.popModifiers();
  }

  pushRemoteElement(
    element: SimpleElement,
    guid: string,
    insertBefore: Maybe<SimpleNode>
  ): Nullable<RemoteLiveBlock> {
    return this.__pushRemoteElement(element, guid, insertBefore);
  }

  __pushRemoteElement(
    element: SimpleElement,
    _guid: string,
    insertBefore: Maybe<SimpleNode>
  ): Nullable<RemoteLiveBlock> {
    this.pushElement(element, insertBefore);

    if (insertBefore === undefined) {
      while (element.lastChild) {
        element.removeChild(element.lastChild);
      }
    }

    let block = new RemoteLiveBlock(element);

    return this.pushLiveBlock(block, true);
  }

  popRemoteElement() {
    this.popBlock();
    this.popElement();
  }

  protected pushElement(
    element: SimpleElement | Element,
    nextSibling: Maybe<SimpleNode | ChildNode> = null
  ) {
    this.#cursors.push(new CursorImpl(element, nextSibling));
  }

  private pushModifiers(modifiers: Nullable<ModifierInstance[]>): void {
    this.modifierStack.push(modifiers);
  }

  private popModifiers(): Nullable<ModifierInstance[]> {
    return this.modifierStack.pop();
  }

  didAppendBounds(bounds: Bounds): Bounds {
    this.block().didAppendBounds(bounds);
    return bounds;
  }

  didAppendNode<T extends SimpleNode>(node: T): T {
    this.block().didAppendNode(node);
    return node;
  }

  didOpenElement(element: SimpleElement): SimpleElement {
    this.block().openElement(element);
    return element;
  }

  willCloseElement() {
    this.block().closeElement();
  }

  appendText(string: string): SimpleText {
    return this.didAppendNode(this.__appendText(string));
  }

  __appendText(text: string): SimpleText {
    let { _dom_, element, nextSibling } = this;
    let node = _dom_.createTextNode(text);
    _dom_.insertBefore(element, node, nextSibling);
    return node;
  }

  __appendNode(node: SimpleNode): SimpleNode {
    this._dom_.insertBefore(this.element, node, this.nextSibling);
    return node;
  }

  __appendFragment(fragment: SimpleDocumentFragment): Bounds {
    let first = fragment.firstChild;

    if (first) {
      let returnValue = new ConcreteBounds(this.element, first, fragment.lastChild!);
      this._dom_.insertBefore(this.element, fragment, this.nextSibling);
      return returnValue;
    } else {
      return new SingleNodeBounds(this.element, this.__appendComment(''));
    }
  }

  __appendHTML(html: string): Bounds {
    return this._dom_.insertHTMLBefore(this.element, this.nextSibling, html);
  }

  appendDynamicHTML(value: string): void {
    let bounds = this.trustedContent(value);
    this.didAppendBounds(bounds);
  }

  appendDynamicText(value: string): SimpleText {
    let node = this.untrustedContent(value);
    this.didAppendNode(node);
    return node;
  }

  appendDynamicFragment(value: SimpleDocumentFragment): void {
    let bounds = this.__appendFragment(value);
    this.didAppendBounds(bounds);
  }

  appendDynamicNode(value: SimpleNode): void {
    let node = this.__appendNode(value);
    let bounds = new SingleNodeBounds(this.element, node);
    this.didAppendBounds(bounds);
  }

  private trustedContent(value: string): Bounds {
    return this.__appendHTML(value);
  }

  private untrustedContent(value: string): SimpleText {
    return this.__appendText(value);
  }

  appendComment(string: string): SimpleComment {
    return this.didAppendNode(this.__appendComment(string));
  }

  __appendComment(string: string): SimpleComment {
    let { _dom_, element, nextSibling } = this;
    let node = _dom_.createComment(string);
    _dom_.insertBefore(element, node, nextSibling);
    return node;
  }

  __setAttribute(name: string, value: string, namespace: Nullable<AttrNamespace>): void {
    this._dom_.setAttribute(this._constructing_, name, value, namespace);
  }

  __setProperty(name: string, value: unknown): void {
    (this._constructing_ as any)[name] = value;
  }

  setStaticAttribute(name: string, value: string, namespace: Nullable<AttrNamespace>): void {
    this.__setAttribute(name, value, namespace);
  }

  setDynamicAttribute(
    name: string,
    value: unknown,
    trusting: boolean,
    namespace: Nullable<AttrNamespace>
  ): DynamicAttribute {
    let element = this._constructing_;
    let attribute = dynamicAttribute(element, name, namespace, trusting);
    attribute.set(this, value, this.env);
    return attribute;
  }
}

export class SimpleLiveBlock<E extends DOMEnvironment = DOMEnvironment> implements LiveBlock<E> {
  protected first: Nullable<FirstNode> = null;
  protected last: Nullable<LastNode> = null;
  protected nesting = 0;
  readonly #parent: Element;

  constructor(parent: E['element']) {
    this.#parent = parent;
  }

  parentElement() {
    return this.#parent;
  }

  firstNode(): ChildNode {
    let first = expect(
      this.first,
      'cannot call `firstNode()` while `SimpleLiveBlock` is still initializing'
    );

    return first.firstNode();
  }

  lastNode(): ChildNode {
    let last = expect(
      this.last,
      'cannot call `lastNode()` while `SimpleLiveBlock` is still initializing'
    );

    return last.lastNode();
  }

  openElement(element: SimpleElement) {
    this.didAppendNode(element);
    this.nesting++;
  }

  closeElement() {
    this.nesting--;
  }

  didAppendNode(node: SimpleNode) {
    if (this.nesting !== 0) return;

    if (!this.first) {
      this.first = First(node);
    }

    this.last = Last(node);
  }

  didAppendBounds(bounds: Bounds) {
    if (this.nesting !== 0) return;

    if (!this.first) {
      this.first = bounds;
    }

    this.last = bounds;
  }

  finalize(stack: ElementBuilder) {
    if (this.first === null) {
      stack.appendComment('');
    }
  }
}

export class RemoteLiveBlock<E extends DOMEnvironment = DOMEnvironment> extends SimpleLiveBlock<E> {
  constructor(parent: E['element']) {
    super(parent);

    registerDestructor(this, () => {
      // In general, you only need to clear the root of a hierarchy, and should never
      // need to clear any child nodes. This is an important constraint that gives us
      // a strong guarantee that clearing a subtree is a single DOM operation.
      //
      // Because remote blocks are not normally physically nested inside of the tree
      // that they are logically nested inside, we manually clear remote blocks when
      // a logical parent is cleared.
      //
      // HOWEVER, it is currently possible for a remote block to be physically nested
      // inside of the block it is logically contained inside of. This happens when
      // the remote block is appended to the end of the application's entire element.
      //
      // The problem with that scenario is that Glimmer believes that it owns more of
      // the DOM than it actually does. The code is attempting to write past the end
      // of the Glimmer-managed root, but Glimmer isn't aware of that.
      //
      // The correct solution to that problem is for Glimmer to be aware of the end
      // of the bounds that it owns, and once we make that change, this check could
      // be removed.
      //
      // For now, a more targeted fix is to check whether the node was already removed
      // and avoid clearing the node if it was. In most cases this shouldn't happen,
      // so this might hide bugs where the code clears nested nodes unnecessarily,
      // so we should eventually try to do the correct fix.
      if (this.parentElement() === this.firstNode().parentNode) {
        clear(this);
      }
    });
  }
}

export class UpdatableBlockImpl
  extends SimpleLiveBlock<BrowserDOMEnvironment>
  implements UpdatableBlock
{
  reset(): Nullable<ChildNode> {
    destroy(this);
    let nextSibling = clear(this);

    this.first = null;
    this.last = null;
    this.nesting = 0;

    return nextSibling;
  }
}

// FIXME: All the noops in here indicate a modelling problem
export class LiveBlockList<E extends DOMEnvironment = DOMEnvironment> implements LiveBlock<E> {
  constructor(private readonly parent: SimpleElement, public boundList: LiveBlock[]) {
    this.parent = parent;
    this.boundList = boundList;
  }

  parentElement() {
    return this.parent;
  }

  firstNode(): E['child'] {
    let head = expect(
      this.boundList[0],
      'cannot call `firstNode()` while `LiveBlockList` is still initializing'
    );

    return head.firstNode();
  }

  lastNode(): E['child'] {
    let boundList = this.boundList;

    let tail = expect(
      boundList.at(-1),
      'cannot call `lastNode()` while `LiveBlockList` is still initializing'
    );

    return tail.lastNode();
  }

  openElement(_element: SimpleElement) {
    assert(false, 'Cannot openElement directly inside a block list');
  }

  closeElement() {
    assert(false, 'Cannot closeElement directly inside a block list');
  }

  didAppendNode(_node: SimpleNode) {
    assert(false, 'Cannot create a new node directly inside a block list');
  }

  didAppendBounds(_bounds: Bounds) {}

  finalize(_stack: ElementBuilder) {
    assert(this.boundList.length > 0, 'boundsList cannot be empty');
  }
}

export function clientBuilder(environment: Environment, cursor: CursorImpl): ElementBuilder {
  return NewElementBuilder.forInitialRender(environment, cursor);
}
