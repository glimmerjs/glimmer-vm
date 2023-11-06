import { destroy, registerDestructor } from '@glimmer/destroyable';
import type {
  AttrNamespace,
  BlockBounds,
  BlockBoundsDebug,
  Cursor,
  DebugStackAspectFrame,
  ElementBuilder,
  ElementOperations,
  Environment,
  FirstNode,
  GlimmerTreeChanges,
  GlimmerTreeConstruction,
  LastNode,
  LiveBlock,
  Maybe,
  ModifierInstance,
  Nullable,
  PartialBoundsDebug,
  SimpleComment,
  SimpleDocumentFragment,
  SimpleElement,
  SimpleNode,
  SimpleText,
  SomeBoundsDebug,
  UpdatableBlock,
  VmStackAspect,
} from '@glimmer/interfaces';
import type { Stack } from '@glimmer/util';
import { assert, BalancedStack, expect, parentDebugFrames, PresentStack } from '@glimmer/util';

import { clear, clearRange, ConcreteBounds, CursorImpl, SingleNodeBounds } from '../bounds';
import { type DynamicAttribute, dynamicAttribute } from './attributes/dynamic';

class First implements FirstNode {
  readonly first: SimpleNode;
  readonly debug?: () => PartialBoundsDebug;

  constructor(node: SimpleNode) {
    this.first = node;

    if (import.meta.env.DEV) {
      this.debug = () => ({ type: 'first', node: this.first });
    }
  }

  firstNode(): SimpleNode {
    return this.first;
  }
}

class Last implements LastNode {
  readonly last: SimpleNode;
  readonly debug?: () => PartialBoundsDebug;

  constructor(node: SimpleNode) {
    this.last = node;

    if (import.meta.env.DEV) {
      this.debug = () => ({ type: 'last', node: this.last });
    }
  }

  lastNode(): SimpleNode {
    return this.last;
  }
}

export class Fragment implements BlockBounds {
  private bounds: BlockBounds;

  constructor(bounds: BlockBounds) {
    this.bounds = bounds;
  }
  debug?: () => SomeBoundsDebug;

  parentElement(): SimpleElement {
    return this.bounds.parentElement();
  }

  get first(): Nullable<SimpleNode> {
    return this.bounds.first;
  }

  get last(): Nullable<SimpleNode> {
    return this.bounds.last;
  }

  firstNode(): SimpleNode {
    return this.bounds.firstNode();
  }

  lastNode(): SimpleNode {
    return this.bounds.lastNode();
  }
}

class ElementBuilderState implements VmStackAspect {
  static initial(cursor: Cursor) {
    return new ElementBuilderState({
      inserting: PresentStack.initial(cursor, 'cursor stack'),
      modifiers: BalancedStack.empty('modifier stack'),
      blocks: BalancedStack.empty('block stack'),
      constructing: BalancedStack.empty('constructing stack'),
    });
  }

  readonly debug?: { frames: DebugStackAspectFrame[] };

  #inserting: PresentStack<Cursor>;
  #modifiers: BalancedStack<ModifierInstance[]>;
  #blocks: BalancedStack<LiveBlock>;
  #constructing: BalancedStack<SimpleElement>;

  constructor({
    inserting,
    modifiers,
    blocks,
    constructing,
  }: {
    inserting: PresentStack<Cursor>;
    modifiers: BalancedStack<ModifierInstance[]>;
    blocks: BalancedStack<LiveBlock>;
    constructing: BalancedStack<SimpleElement>;
  }) {
    this.#inserting = inserting;
    this.#modifiers = modifiers;
    this.#blocks = blocks;
    this.#constructing = constructing;

    if (import.meta.env.DEV) {
      Object.defineProperty(this, 'debug', {
        configurable: true,
        get: function (this: ElementBuilderState): { frames: DebugStackAspectFrame[] } {
          return parentDebugFrames('element builder', {
            inserting: this.#inserting,
            modifiers: this.#modifiers,
            blocks: this.#blocks,
            constructing: this.#constructing,
          });
        },
      });
    }
  }

  get inserting(): PresentStack<Cursor> {
    return this.#inserting;
  }

  get modifiers(): Stack<Nullable<ModifierInstance[]>> {
    return this.#modifiers;
  }

  get blocks(): BalancedStack<LiveBlock> {
    return this.#blocks;
  }

  get block() {
    return this.#blocks.present;
  }

  get cursor(): Cursor {
    return this.#inserting.current;
  }

  begin(): this {
    this.#inserting = this.#inserting.begin();
    this.#modifiers = this.#modifiers.begin();
    this.#blocks = this.#blocks.begin();
    this.#constructing = this.#constructing.begin();
    return this;
  }

  catch(): this {
    this.#inserting = this.#inserting.catch();
    this.#modifiers = this.#modifiers.catch();
    this.#blocks = this.#blocks.catch();
    this.#constructing = this.#constructing.catch();
    return this;
  }

  finally(): this {
    this.#inserting = this.#inserting.finally();
    this.#modifiers = this.#modifiers.finally();
    this.#blocks = this.#blocks.finally();
    this.#constructing = this.#constructing.finally();
    return this;
  }
}

export abstract class AbstractElementBuilder implements ElementBuilder {
  static forInitialRender<
    This extends new (
      env: Environment,
      element: SimpleElement,
      nextSibling: Nullable<SimpleNode>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) => any,
  >(this: This, env: Environment, cursor: Cursor): InstanceType<This> {
    return new this(env, cursor.element, cursor.nextSibling).initialize() as InstanceType<This>;
  }

  readonly #state: ElementBuilderState;
  public dom: GlimmerTreeConstruction;
  public updateOperations: GlimmerTreeChanges;
  public constructing: Nullable<SimpleElement> = null;
  public operations: Nullable<ElementOperations> = null;
  private env: Environment;

  constructor(env: Environment, parentNode: SimpleElement, nextSibling: Nullable<SimpleNode>) {
    this.#state = ElementBuilderState.initial(this.createCursor(parentNode, nextSibling));

    this.env = env;
    this.dom = env.getAppendOperations();
    this.updateOperations = env.getDOM();
  }
  abstract createCursor(element: SimpleElement, nextSibling: Nullable<SimpleNode>): Cursor;

  debugBlocks(): LiveBlock[] {
    throw new Error('Method not implemented.');
  }

  get currentCursor(): ReturnType<this['createCursor']> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.#state.cursor as any;
  }

  begin(): LiveBlock {
    const block = this.pushUpdatableBlock();
    this.#state.begin();
    return block;
  }

  finally(): LiveBlock {
    this.#state.finally();
    return this.popBlock(false);
  }

  catch(): LiveBlock {
    this.#state.catch();
    const block = this.catchBlock();
    return block;
  }

  pushCursor(cursor: ReturnType<this['createCursor']>): void {
    this.#state.inserting.push(cursor);
  }

  protected initialize(): this {
    this.pushSimpleBlock();

    return this;
  }

  get debug(): ElementBuilder['debug'] {
    return {
      blocks: this.#state.blocks.toArray(),
      constructing: this.constructing,
      inserting: this.#state.inserting.toArray(),
    };
  }

  get element(): SimpleElement {
    return this.#state.cursor.element;
  }

  get nextSibling(): Nullable<SimpleNode> {
    return this.#state.cursor.nextSibling;
  }

  get hasBlocks() {
    return this.#state.blocks.size > 0;
  }

  get block(): LiveBlock {
    return this.#state.block;
  }

  popElement() {
    this.#state.inserting.pop();
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

  protected pushLiveBlock<T extends LiveBlock>(block: T, _isRemote?: boolean): T {
    this.__openBlock();
    this.#state.blocks.push(block);
    return block;
  }

  catchBlock(): LiveBlock {
    this.block.catch(this);
    const block = this.#closeBlock();

    const current = this.#state.blocks.current;
    if (current !== null) {
      current.didAppendBounds(block);
    }

    return block;
  }

  popBlock(isRemote: boolean): LiveBlock {
    this.block.finalize(this);
    const block = this.#closeBlock();

    const current = this.#state.blocks.current;
    if (current !== null && !isRemote) {
      current.didAppendBounds(block);
    }

    return block;
  }

  #closeBlock(): LiveBlock {
    this.__closeBlock();
    return this.#state.blocks.pop();
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
    this.popBlock(true);
    this.popElement();
  }

  protected pushElement(element: SimpleElement, nextSibling: Maybe<SimpleNode> = null) {
    this.#state.inserting.push(this.createCursor(element, nextSibling));
  }

  private pushModifiers(modifiers: Nullable<ModifierInstance[]>): void {
    this.#state.modifiers.push(modifiers);
  }

  private popModifiers(): Nullable<ModifierInstance[]> {
    return this.#state.modifiers.pop();
  }

  didAppendBounds(bounds: BlockBounds): BlockBounds {
    this.block.didAppendBounds(bounds);
    return bounds;
  }

  didAppendNode<T extends SimpleNode>(node: T): T {
    this.block.didAppendNode(node);
    return node;
  }

  didOpenElement(element: SimpleElement): SimpleElement {
    this.block.openElement(element);
    return element;
  }

  willCloseElement() {
    this.block.closeElement();
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

  __appendFragment(fragment: SimpleDocumentFragment): BlockBounds {
    let first = fragment.firstChild;

    if (first) {
      let ret = new ConcreteBounds(this.element, first, fragment.lastChild!);
      this.dom.insertBefore(this.element, fragment, this.nextSibling);
      return ret;
    } else {
      return new SingleNodeBounds(this.element, this.__appendComment(''));
    }
  }

  __appendHTML(html: string): BlockBounds {
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

  private trustedContent(value: string): BlockBounds {
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

export class NewElementBuilder extends AbstractElementBuilder {
  static resume(env: Environment, block: UpdatableBlock): NewElementBuilder {
    let parentNode = block.parentElement();
    let nextSibling = block.reset(env);

    let stack = new this(env, parentNode, nextSibling).initialize();
    stack.pushLiveBlock(block);

    return stack;
  }

  createCursor(element: SimpleElement, nextSibling: Nullable<SimpleNode>): Cursor {
    return new CursorImpl(element, nextSibling);
  }
}

export class SimpleLiveBlock implements LiveBlock {
  #first: Nullable<FirstNode> = null;
  #last: Nullable<LastNode> = null;

  protected nesting = 0;
  declare debug?: () => BlockBoundsDebug;

  constructor(private parent: SimpleElement) {
    ifDev(() => {
      this.debug = (): BlockBoundsDebug => {
        return liveBlockDebug('SimpleLiveBlock', this.first, this.last, parent);
      };
    });
  }

  get first(): Nullable<SimpleNode> {
    return this.#first?.first ?? null;
  }

  set first(first: Nullable<SimpleNode>) {
    this.#first = first ? new First(first) : null;
  }

  get last(): Nullable<SimpleNode> {
    return this.#last?.last ?? null;
  }

  set last(last: Nullable<SimpleNode>) {
    this.#last = last ? new Last(last) : null;
  }

  parentElement() {
    return this.parent;
  }

  isEmpty(): boolean {
    return this.first === null;
  }

  firstNode(): SimpleNode {
    let first = expect(
      this.first,
      'cannot call `firstNode()` while `SimpleLiveBlock` is still initializing'
    );

    return first;
  }

  lastNode(): SimpleNode {
    let last = expect(
      this.last,
      'cannot call `lastNode()` while `SimpleLiveBlock` is still initializing'
    );

    return last;
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
      this.#first = new First(node);
    }

    this.#last = new Last(node);
  }

  didAppendBounds(bounds: BlockBounds) {
    if (this.nesting !== 0) return;

    assert(bounds.last !== null, `only append bounds with content`);

    if (!this.first) {
      this.#first = bounds;
    }

    this.#last = bounds;
  }

  catch(stack: ElementBuilder) {
    const { first, last, parent } = this;

    if (first && last) {
      clearRange({ parent, first, last });
    }

    this.first = this.last = stack.appendComment('');
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
      // In general, you only need to clear the root of a hierarchy, and should never need to clear
      // any child nodes. This is an important constraint that gives us a strong guarantee that
      // clearing a subtree is a single DOM operation.
      //
      // Because remote blocks are not normally physically nested inside of the tree that they are
      // logically nested inside, we manually clear remote blocks when a logical parent is cleared.
      //
      // HOWEVER, it is currently possible for a remote block to be physically nested inside of the
      // block it is logically contained inside of. This happens when the remote block is appended
      // to the end of the application's entire element.
      //
      // The problem with that scenario is that Glimmer believes that it owns more of the DOM than
      // it actually does. The code is attempting to write past the end of the Glimmer-managed root,
      // but Glimmer isn't aware of that.
      //
      // The correct solution to that problem is for Glimmer to be aware of the end of the bounds
      // that it owns, and once we make that change, this check could be removed.
      //
      // For now, a more targeted fix is to check whether the node was already removed and avoid
      // clearing the node if it was. In most cases this shouldn't happen, so this might hide bugs
      // where the code clears nested nodes unnecessarily, so we should eventually try to do the
      // correct fix.
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
  readonly debug?: () => BlockBoundsDebug;

  constructor(
    private readonly parent: SimpleElement,
    public boundList: BlockBounds[]
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

  get first(): Nullable<SimpleNode> {
    const [first] = this.boundList;
    return first?.first ?? null;
  }

  get last(): Nullable<SimpleNode> {
    const last = this.boundList.at(-1);
    return last?.last ?? null;
  }

  catch(stack: ElementBuilder): void {
    let { first, last } = this;

    if (first && last) {
      clearRange({ parent: this.parent, first, last });
    }

    const comment = stack.appendComment('');
    this.boundList = [new SingleNodeBounds(this.parent, comment)];
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

  didAppendBounds(_bounds: BlockBounds) {}

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

function getFirstNodeFromDebug(debug: SomeBoundsDebug | undefined): SimpleNode | undefined {
  switch (debug?.type) {
    case undefined:
    case 'empty':
    case 'last':
      return;
    case 'range':
      return debug.range[0];
    case 'first':
      return debug.node;
  }
}

function getLastNodeFromDebug(debug: SomeBoundsDebug | undefined): SimpleNode | undefined {
  switch (debug?.type) {
    case undefined:
    case 'empty':
    case 'first':
      return;
    case 'range':
      return debug.range[1];
  }
}

function joinRange(
  kind: string,
  firstBlock: SomeBoundsDebug | undefined,
  lastBlock: SomeBoundsDebug | undefined,
  parent: SimpleElement
): BlockBoundsDebug {
  const firstNode = getFirstNodeFromDebug(firstBlock);
  const lastNode = getLastNodeFromDebug(lastBlock);

  if (firstNode && lastNode) {
    return debugRange(kind, [firstNode, lastNode]);
  } else if (firstBlock?.type === 'range') {
    return firstBlock;
  } else if (lastBlock?.type === 'range') {
    return lastBlock;
  } else {
    return empty(kind, parent);
  }
}

function empty(kind: string, parent: SimpleElement): BlockBoundsDebug {
  return { type: 'empty', kind, parent };
}

function debugRange(kind: string, [first, last]: [SimpleNode, SimpleNode]): BlockBoundsDebug {
  return { type: 'range', kind, range: [first, last], collapsed: first === last };
}

function liveBlockDebug(
  kind: string,
  first: Nullable<SimpleNode>,
  last: Nullable<SimpleNode>,
  parent: SimpleElement
): BlockBoundsDebug {
  if (first && last) {
    return { type: 'range', kind, range: [first, last], collapsed: first === last };
  } else {
    return { type: 'empty', kind, parent };
  }
}
