/* eslint-disable unicorn/prefer-dom-node-remove */
import { destroy, registerDestructor } from '@glimmer/destroyable';
import type {
  AttrNamespace,
  Bounds,
  BrowserDOMEnvironment,
  ChildNodeFor,
  CommentFor,
  Cursor,
  DebugElementBuilder,
  DocumentFragmentFor,
  DOMEnvironment,
  ElementBuilder,
  ElementOperations,
  Environment,
  GlimmerTreeChanges,
  GlimmerTreeConstruction,
  LiveBlock,
  Maybe,
  ModifierInstance,
  NodeFor,
  Nullable,
  SimpleDocumentFragment,
  SimpleElement,
  SimpleNode,
  TextFor,
  UpdatableBlock,
} from '@glimmer/interfaces';
import { assert, castToBrowser, expect, Stack } from '@glimmer/util';

import { clear, ConcreteBounds, CursorImpl, SingleNodeBounds } from '../bounds';
import { type DynamicAttribute, dynamicAttribute } from './attributes/dynamic';
import { clearBlockBounds, type BlockBoundsRef } from '../dom/tree-builder';

export type FirstNode<E extends DOMEnvironment = DOMEnvironment> = Pick<Bounds<E>, 'firstNode'>;
export type LastNode<E extends DOMEnvironment = DOMEnvironment> = Pick<Bounds<E>, 'lastNode'>;

function First<E extends DOMEnvironment = DOMEnvironment>(node: E['child']): FirstNode<E> {
  return {
    firstNode: () => node,
  };
}

function Last<E extends DOMEnvironment = DOMEnvironment>(node: E['child']): LastNode<E> {
  return {
    lastNode: () => node,
  };
}

export class NewElementBuilder<E extends DOMEnvironment = DOMEnvironment>
  implements ElementBuilder<E>
{
  public _dom_: GlimmerTreeConstruction<E>;
  public _updateOperations_: GlimmerTreeChanges;
  public _constructing_: Nullable<E['element']> = null;
  public operations: Nullable<ElementOperations> = null;
  private env: Environment;

  readonly #cursors = new Stack<Cursor<E>>();
  private modifierStack = new Stack<Nullable<ModifierInstance[]>>();
  private blockStack = new Stack<LiveBlock>();

  static forInitialRender<E extends DOMEnvironment>(
    environment: Environment,
    cursor: CursorImpl<E>
  ) {
    return new this(environment, cursor.element, cursor.nextSibling).initialize();
  }

  static resume(
    environment: Environment,
    block: BlockBoundsRef
  ): NewElementBuilder<BrowserDOMEnvironment> {
    let parentNode = block.parent;
    let nextSibling = clearBlockBounds(block);

    let stack = new NewElementBuilder<BrowserDOMEnvironment>(
      environment,
      castToBrowser(parentNode, 'ELEMENT'),
      nextSibling
    ).initialize();
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
    this._dom_ = environment.getAppendOperations([parentNode, nextSibling, null]);
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

  debugBlocks(): LiveBlock<E>[] {
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

  protected block(): LiveBlock<E> {
    return expect(this.blockStack.current, 'Expected a current live block');
  }

  popElement() {
    this.#cursors.pop();
    expect(this.#cursors.current, "can't pop past the last element");
  }

  pushSimpleBlock(): LiveBlock<E> {
    return this.pushLiveBlock(new SimpleLiveBlock(this.element));
  }

  pushUpdatableBlock(): UpdatableBlockImpl {
    // TODO [2023-05-22] don't emit updatable blocks in SSR
    return this.pushLiveBlock(new UpdatableBlockImpl(this.element));
  }

  pushBlockList(list: LiveBlock<E>[]): LiveBlockList<E> {
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

  popBlock(): LiveBlock<E> {
    this.block().finalize(this);
    this.__closeBlock();
    return expect(this.blockStack.pop(), 'Expected popBlock to return a block');
  }

  __openBlock(): void {}
  __closeBlock(): void {}

  // todo return seems unused
  openElement(tag: string): E['element'] {
    let element = this.__openElement(tag);
    this._constructing_ = element;

    return element;
  }

  __openElement(tag: string): E['element'] {
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

  __flushElement(parent: E['element'], constructing: E['element']) {
    this._dom_.insertBefore(parent, constructing, this.nextSibling);
  }

  closeElement(): Nullable<ModifierInstance[]> {
    this.willCloseElement();
    this.popElement();
    return this.popModifiers();
  }

  pushRemoteElement(
    element: E['element'],
    guid: string,
    insertBefore: Maybe<NodeFor<E>>
  ): Nullable<RemoteLiveBlock<E>> {
    return this.__pushRemoteElement(element, guid, insertBefore);
  }

  __pushRemoteElement(
    element: E['element'],
    _guid: string,
    insertBefore: Maybe<NodeFor<E>>
  ): Nullable<RemoteLiveBlock<E>> {
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

  didAppendBounds(bounds: Bounds<E>): Bounds {
    this.block().didAppendBounds(bounds);
    return bounds;
  }

  didAppendNode<T extends ChildNodeFor<E>>(node: T): T {
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

  appendText(string: string): TextFor<E> {
    return this.didAppendNode(this.__appendText(string));
  }

  __appendText(text: string): TextFor<E> {
    let { _dom_, element, nextSibling } = this;
    let node = _dom_.createTextNode(text);
    _dom_.insertBefore(element, node, nextSibling);
    return node;
  }

  __appendNode(node: E['child']): E['child'] {
    this._dom_.insertBefore(this.element, node, this.nextSibling);
    return node;
  }

  __appendFragment(fragment: DocumentFragmentFor<E>): Bounds<E> {
    let first = fragment.firstChild;

    if (first) {
      let returnValue = new ConcreteBounds(this.element, first, fragment.lastChild!);
      this._dom_.insertBefore(this.element, fragment, this.nextSibling);
      return returnValue;
    } else {
      return new SingleNodeBounds(this.element, this.__appendComment(''));
    }
  }

  __appendHTML(html: string): Bounds<E> {
    return this._dom_.insertHTMLBefore(this.element, this.nextSibling, html);
  }

  appendDynamicHTML(value: string): void {
    let bounds = this.trustedContent(value);
    this.didAppendBounds(bounds);
  }

  appendDynamicText(value: string): TextFor<E> {
    let node = this.untrustedContent(value);
    this.didAppendNode(node);
    return node;
  }

  appendDynamicFragment(value: NodeFor<E, SimpleDocumentFragment | DocumentFragment>): void {
    let bounds = this.__appendFragment(value);
    this.didAppendBounds(bounds);
  }

  appendDynamicNode(value: NodeFor<E>): void {
    let node = this.__appendNode(value);
    let bounds = new SingleNodeBounds(this.element, node);
    this.didAppendBounds(bounds);
  }

  private trustedContent(value: string): Bounds<E> {
    return this.__appendHTML(value);
  }

  private untrustedContent(value: string): TextFor<E> {
    return this.__appendText(value);
  }

  appendComment(string: string): CommentFor<E> {
    return this.didAppendNode(this.__appendComment(string));
  }

  __appendComment(string: string): CommentFor<E> {
    let { _dom_, element, nextSibling } = this;
    let node = _dom_.createComment(string);
    _dom_.insertBefore(element, node, nextSibling);
    return node;
  }

  __setAttribute(name: string, value: string, namespace: Nullable<AttrNamespace>): void {
    this._dom_.setAttribute(this._constructing_!, name, value, namespace);
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
  ): DynamicAttribute<E> {
    let element = this._constructing_;
    let attribute = dynamicAttribute(this, element, name, namespace, trusting);
    attribute.set(this, value, this.env);
    return attribute;
  }
}

export class SimpleLiveBlock<E extends DOMEnvironment = DOMEnvironment> implements LiveBlock<E> {
  protected first: Nullable<FirstNode> = null;
  protected last: Nullable<LastNode> = null;
  protected nesting = 0;
  readonly #parent: E['element'];

  constructor(parent: E['element']) {
    this.#parent = parent;
  }

  parentElement() {
    return this.#parent;
  }

  firstNode(): E['child'] {
    let first = expect(
      this.first,
      'cannot call `firstNode()` while `SimpleLiveBlock` is still initializing'
    );

    return first.firstNode();
  }

  lastNode(): E['child'] {
    let last = expect(
      this.last,
      'cannot call `lastNode()` while `SimpleLiveBlock` is still initializing'
    );

    return last.lastNode();
  }

  openElement(element: E['element']) {
    this.didAppendNode(element);
    this.nesting++;
  }

  closeElement() {
    this.nesting--;
  }

  didAppendNode(node: E['child']) {
    if (this.nesting !== 0) return;

    if (!this.first) {
      this.first = First(node);
    }

    this.last = Last(node);
  }

  didAppendBounds(bounds: Bounds<E>) {
    if (this.nesting !== 0) return;

    if (!this.first) {
      this.first = bounds;
    }

    this.last = bounds;
  }

  finalize(stack: ElementBuilder<E>) {
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
  implements LiveBlock<BrowserDOMEnvironment>, UpdatableBlock
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
  constructor(private readonly parent: E['element'], public boundList: LiveBlock<E>[]) {
    this.parent = parent;
    this.boundList = boundList;
  }

  parentElement(): E['element'] {
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

  openElement(_element: E['element']) {
    assert(false, 'Cannot openElement directly inside a block list');
  }

  closeElement() {
    assert(false, 'Cannot closeElement directly inside a block list');
  }

  didAppendNode(_node: E['child']) {
    assert(false, 'Cannot create a new node directly inside a block list');
  }

  didAppendBounds(_bounds: Bounds<E>) {}

  finalize(_stack: ElementBuilder<E>) {
    assert(this.boundList.length > 0, 'boundsList cannot be empty');
  }
}

export function clientBuilder(environment: Environment, cursor: CursorImpl): ElementBuilder {
  return NewElementBuilder.forInitialRender(environment, cursor);
}
