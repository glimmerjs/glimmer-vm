import { destroy, registerDestructor } from '@glimmer/destroyable';
import type {
  AttrNamespace,
  Bounds,
  Cursor,
  ElementBuilder,
  ElementOperations,
  Environment,
  GlimmerTreeChanges,
  GlimmerTreeConstruction,
  LiveBlock,
  LiveBlockDebug,
  Maybe,
  ModifierInstance,
  Nullable,
  SimpleComment,
  SimpleDocumentFragment,
  SimpleElement,
  SimpleNode,
  SimpleText,
  UpdatableBlock,
} from '@glimmer/interfaces';
import { assert, expect, Stack } from '@glimmer/util';

import { clear, ConcreteBounds, CursorImpl, SingleNodeBounds } from '../bounds';
import { type DynamicAttribute, dynamicAttribute } from './attributes/dynamic';

export interface FirstNode {
  // `firstNode()` is allowed to throw during construction
  debug?: { readonly firstNode: SimpleNode };

  firstNode(): SimpleNode;
}

export interface LastNode {
  // `lastNode()` is allowed to throw during construction
  debug?: { readonly lastNode: SimpleNode };

  lastNode(): SimpleNode;
}

class First implements FirstNode {
  readonly #node: SimpleNode;
  declare debug?: { readonly firstNode: SimpleNode };

  constructor(node: SimpleNode) {
    this.#node = node;

    ifDev(() => {
      this.debug = { firstNode: this.#node };
    });
  }

  firstNode(): SimpleNode {
    return this.#node;
  }
}

class Last {
  readonly #node: SimpleNode;
  declare debug?: { readonly lastNode: SimpleNode };

  constructor(node: SimpleNode) {
    this.#node = node;

    ifDev(() => {
      this.debug = { lastNode: this.#node };
    });
  }

  lastNode(): SimpleNode {
    return this.#node;
  }
}

export class Fragment implements Bounds {
  private bounds: Bounds;

  constructor(bounds: Bounds) {
    this.bounds = bounds;
  }

  parentElement(): SimpleElement {
    return this.bounds.parentElement();
  }

  firstNode(): SimpleNode {
    return this.bounds.firstNode();
  }

  lastNode(): SimpleNode {
    return this.bounds.lastNode();
  }
}

class TryState {
  static root(element: SimpleElement) {
    return new TryState(new SimpleLiveBlock(element), null);
  }

  #block: SimpleLiveBlock;
  #parent: TryState | null;

  constructor(block: SimpleLiveBlock, parent: TryState | null) {
    this.#parent = parent;
    this.#block = block;
  }

  get block(): SimpleLiveBlock {
    return this.#block;
  }

  child(element: SimpleElement) {
    return new TryState(new SimpleLiveBlock(element), this);
  }

  catch() {
    clear(this.#block);
    return this.#parent;
  }

  finally() {
    return this.#parent;
  }
}

export abstract class AbstractElementBuilder<C extends Cursor> implements ElementBuilder {
  static forInitialRender<
    This extends new (
      env: Environment,
      element: SimpleElement,
      nextSibling: Nullable<SimpleNode>
    ) => AbstractElementBuilder<C>,
    C extends Cursor,
  >(this: This, env: Environment, cursor: CursorImpl): InstanceType<This> {
    return new this(env, cursor.element, cursor.nextSibling).initialize() as InstanceType<This>;
  }

  public dom: GlimmerTreeConstruction;
  public updateOperations: GlimmerTreeChanges;
  public constructing: Nullable<SimpleElement> = null;
  public operations: Nullable<ElementOperations> = null;
  private env: Environment;

  readonly #cursors = new Stack<C>();
  private modifierStack = new Stack<Nullable<ModifierInstance[]>>();
  private blockStack = new Stack<LiveBlock>();
  #try: TryState;

  constructor(env: Environment, parentNode: SimpleElement, nextSibling: Nullable<SimpleNode>) {
    this.pushElement(parentNode, nextSibling);

    this.env = env;
    this.dom = env.getAppendOperations();
    this.updateOperations = env.getDOM();
    this.#try = TryState.root(parentNode);
  }

  protected abstract createCursor(element: SimpleElement, nextSibling: Nullable<SimpleNode>): C;

  debugBlocks(): LiveBlock[] {
    throw new Error('Method not implemented.');
  }

  get currentCursor(): Nullable<C> {
    return this.#cursors.current;
  }

  pushTryFrame(): void {
    this.#try = this.#try.child(this.element);
  }

  popTryFrame(): void {
    this.#try = expect(
      this.#try.finally(),
      `BUG: The element builder is initialized with a root try block, so it should be impossible to pop the last try frame.`
    );
  }

  catch(): void {
    this.#try = expect(
      this.#try.catch(),
      `BUG: The element builder is initialized with a root try block, so it should be impossible to pop the last try frame.`
    );
  }

  pushCursor(cursor: C): void {
    this.#cursors.push(cursor);
  }

  protected initialize(): this {
    this.pushSimpleBlock();
    return this;
  }

  get debug(): ElementBuilder['debug'] {
    return {
      blocks: this.blockStack.toArray(),
      constructing: this.constructing,
      inserting: this.#cursors.toArray(),
    };
  }

  get element(): SimpleElement {
    return this.#cursors.current!.element;
  }

  get nextSibling(): Nullable<SimpleNode> {
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

  pushUpdatableBlock(): UpdatableBlockImpl {
    return this.pushLiveBlock(new UpdatableBlockImpl(this.element));
  }

  pushBlockList(list: LiveBlock[]): LiveBlockList {
    return this.pushLiveBlock(new LiveBlockList(this.element, list));
  }

  protected pushLiveBlock<T extends LiveBlock>(block: T, isRemote = false): T {
    let current = this.blockStack.current;

    if (current !== null) {
      if (!isRemote) {
        current.didAppendBounds(block);
      }
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
    this.constructing = element;

    return element;
  }

  __openElement(tag: string): SimpleElement {
    return this.dom.createElement(tag, this.element);
  }

  flushElement(modifiers: Nullable<ModifierInstance[]>) {
    let parent = this.element;
    let element = expect(
      this.constructing,
      `flushElement should only be called when constructing an element`
    );

    this.__flushElement(parent, element);

    this.constructing = null;
    this.operations = null;

    this.pushModifiers(modifiers);
    this.pushElement(element, null);
    this.didOpenElement(element);
  }

  __flushElement(parent: SimpleElement, constructing: SimpleElement) {
    this.dom.insertBefore(parent, constructing, this.nextSibling);
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

  protected pushElement(element: SimpleElement, nextSibling: Maybe<SimpleNode> = null) {
    this.#cursors.push(this.createCursor(element, nextSibling));
  }

  private pushModifiers(modifiers: Nullable<ModifierInstance[]>): void {
    this.modifierStack.push(modifiers);
  }

  private popModifiers(): Nullable<ModifierInstance[]> {
    return this.modifierStack.pop();
  }

  didAppendBounds(bounds: Bounds): Bounds {
    this.#try.block.didAppendBounds(bounds);
    this.block().didAppendBounds(bounds);
    return bounds;
  }

  didAppendNode<T extends SimpleNode>(node: T): T {
    this.#try.block.didAppendNode(node);
    this.block().didAppendNode(node);
    return node;
  }

  didOpenElement(element: SimpleElement): SimpleElement {
    this.#try.block.openElement(element);
    this.block().openElement(element);
    return element;
  }

  willCloseElement() {
    this.#try.block.closeElement();
    this.block().closeElement();
  }

  appendText(string: string): SimpleText {
    return this.didAppendNode(this.__appendText(string));
  }

  __appendText(text: string): SimpleText {
    let { dom, element, nextSibling } = this;
    let node = dom.createTextNode(text);
    dom.insertBefore(element, node, nextSibling);
    return node;
  }

  __appendNode(node: SimpleNode): SimpleNode {
    this.dom.insertBefore(this.element, node, this.nextSibling);
    return node;
  }

  __appendFragment(fragment: SimpleDocumentFragment): Bounds {
    let first = fragment.firstChild;

    if (first) {
      let ret = new ConcreteBounds(this.element, first, fragment.lastChild!);
      this.dom.insertBefore(this.element, fragment, this.nextSibling);
      return ret;
    } else {
      return new SingleNodeBounds(this.element, this.__appendComment(''));
    }
  }

  __appendHTML(html: string): Bounds {
    return this.dom.insertHTMLBefore(this.element, this.nextSibling, html);
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
    let { dom, element, nextSibling } = this;
    let node = dom.createComment(string);
    dom.insertBefore(element, node, nextSibling);
    return node;
  }

  __setAttribute(name: string, value: string, namespace: Nullable<AttrNamespace>): void {
    this.dom.setAttribute(this.constructing!, name, value, namespace);
  }

  __setProperty(name: string, value: unknown): void {
    Reflect.set(this.constructing!, name, value);
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
    let element = this.constructing!;
    let attribute = dynamicAttribute(element, name, namespace, trusting);
    attribute.set(this, value, this.env);
    return attribute;
  }
}

export class NewElementBuilder extends AbstractElementBuilder<Cursor> {
  static resume(env: Environment, block: UpdatableBlock): NewElementBuilder {
    let parentNode = block.parentElement();
    let nextSibling = block.reset(env);

    let stack = new this(env, parentNode, nextSibling).initialize();
    stack.pushLiveBlock(block);

    return stack;
  }

  protected createCursor(element: SimpleElement, nextSibling: Nullable<SimpleNode>): Cursor {
    return new CursorImpl(element, nextSibling);
  }
}

export class SimpleLiveBlock implements LiveBlock {
  protected first: Nullable<FirstNode> = null;
  protected last: Nullable<LastNode> = null;
  protected nesting = 0;
  declare debug?: () => LiveBlockDebug;

  constructor(private parent: SimpleElement) {
    ifDev(() => {
      this.debug = (): LiveBlockDebug => {
        return liveBlockDebug('SimpleLiveBlock', this.first, this.last, parent);
      };
    });
  }

  parentElement() {
    return this.parent;
  }

  firstNode(): SimpleNode {
    let first = expect(
      this.first,
      'cannot call `firstNode()` while `SimpleLiveBlock` is still initializing'
    );

    return first.firstNode();
  }

  lastNode(): SimpleNode {
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
      this.first = new First(node);
    }

    this.last = new Last(node);
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

export class RemoteLiveBlock extends SimpleLiveBlock {
  constructor(parent: SimpleElement) {
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

    ifDev(() => {
      this.debug = () => {
        return liveBlockDebug('RemoteLiveBlock', this.first, this.last, parent);
      };
    });
  }
}

export class UpdatableBlockImpl extends SimpleLiveBlock implements UpdatableBlock {
  constructor(parent: SimpleElement) {
    super(parent);

    ifDev(() => {
      this.debug = () => {
        return liveBlockDebug('UpdatableBlock', this.first, this.last, parent);
      };
    });
  }

  reset(): Nullable<SimpleNode> {
    destroy(this);
    let nextSibling = clear(this);

    this.first = null;
    this.last = null;
    this.nesting = 0;

    return nextSibling;
  }
}

// FIXME: All the noops in here indicate a modelling problem
export class LiveBlockList implements LiveBlock {
  readonly debug?: () => LiveBlockDebug;

  constructor(
    private readonly parent: SimpleElement,
    public boundList: LiveBlock[]
  ) {
    this.parent = parent;
    this.boundList = boundList;

    if (import.meta.env.DEV) {
      this.debug = () => {
        const bounds = this.boundList;
        const parent = this.parent;

        return joinRange(
          'LiveBlockList',
          this.boundList.at(0)?.debug?.(),
          bounds.at(-1)?.debug?.(),
          parent
        );
      };
    }
  }

  parentElement() {
    return this.parent;
  }

  firstNode(): SimpleNode {
    let head = expect(
      this.boundList[0],
      'cannot call `firstNode()` while `LiveBlockList` is still initializing'
    );

    return head.firstNode();
  }

  lastNode(): SimpleNode {
    let boundList = this.boundList;

    let tail = expect(
      boundList[boundList.length - 1],
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

export function clientBuilder(env: Environment, cursor: CursorImpl): ElementBuilder {
  return NewElementBuilder.forInitialRender(env, cursor);
}

function ifDev<T>(callback: () => T): void {
  if (import.meta.env.DEV) {
    callback();
  }
}

function getNodesFromDebug(
  debug: LiveBlockDebug | undefined
): [SimpleNode, SimpleNode] | undefined {
  if (debug === undefined || debug.type === 'empty') return;
  return debug.range;
}

function joinRange(
  kind: string,
  firstBlock: LiveBlockDebug | undefined,
  lastBlock: LiveBlockDebug | undefined,
  parent: SimpleElement
): LiveBlockDebug {
  const firstNodes = getNodesFromDebug(firstBlock);
  const lastNodes = getNodesFromDebug(lastBlock);

  if (firstNodes && lastNodes) {
    return debugRange(kind, [firstNodes[0], lastNodes[1]]);
  } else if (firstBlock) {
    return firstBlock;
  } else if (lastBlock) {
    return lastBlock;
  } else {
    return empty(kind, parent);
  }
}

function empty(kind: string, parent: SimpleElement): LiveBlockDebug {
  return { type: 'empty', kind, parent };
}

function debugRange(kind: string, [first, last]: [SimpleNode, SimpleNode]): LiveBlockDebug {
  return { type: 'range', kind, range: [first, last], collapsed: first === last };
}

function liveBlockDebug(
  kind: string,
  firstNode: Nullable<FirstNode> | undefined,
  lastNode: Nullable<LastNode> | undefined,
  parent: SimpleElement
): LiveBlockDebug {
  const first = firstNode?.debug?.firstNode;
  const last = lastNode?.debug?.lastNode;

  if (first && last) {
    return { type: 'range', kind, range: [first, last], collapsed: first === last };
  } else {
    return { type: 'empty', kind, parent };
  }
}
