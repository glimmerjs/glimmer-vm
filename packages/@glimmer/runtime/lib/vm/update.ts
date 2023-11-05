import { associateDestroyableChild, destroy, destroyChildren } from '@glimmer/destroyable';
import type {
  BlockBounds,
  Destroyable,
  DynamicScope,
  ElementBuilder,
  Environment,
  ExceptionHandler,
  GlimmerTreeChanges,
  HandleException,
  JitContext,
  LiveBlock,
  Nullable,
  Result,
  RuntimeContext,
  Scope,
  SimpleComment,
  UpdatableBlock,
  UpdatingOpcode,
  UpdatingVM as IUpdatingVM,
} from '@glimmer/interfaces';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import {
  type OpaqueIterationItem,
  type OpaqueIterator,
  readReactive,
  type SomeReactive,
  updateRef,
} from '@glimmer/reference';
import { expect, logStep, Stack, unwrap } from '@glimmer/util';
import { debug, resetTracking } from '@glimmer/validator';

import { clear, move as moveBounds } from '../bounds';
import { VM } from './append';
import { type LiveBlockList, NewElementBuilder } from './element-builder';
import type { UnwindTarget } from './unwind';

export class UpdatingVM implements IUpdatingVM {
  public env: Environment;
  public dom: GlimmerTreeChanges;
  public alwaysRevalidate: boolean;

  readonly #frameStack = Stack.empty<UpdatingVMFrame>();

  constructor(env: Environment, { alwaysRevalidate = false }) {
    this.env = env;
    this.dom = env.getDOM();
    this.alwaysRevalidate = alwaysRevalidate;
  }

  execute(opcodes: UpdatingOpcode[], handler: ExceptionHandler) {
    if (import.meta.env.DEV) {
      let hasErrored = true;
      try {
        debug.runInTrackingTransaction!(
          () => this._execute(opcodes, handler),
          '- While rendering:'
        );

        // using a boolean here to avoid breaking ergonomics of "pause on uncaught exceptions" which
        // would happen with a `catch` + `throw`
        hasErrored = false;
      } finally {
        if (hasErrored) {
          // eslint-disable-next-line no-console
          console.error(`\n\nError occurred:\n\n${resetTracking()}\n\n`);
        }
      }
    } else {
      this._execute(opcodes, handler);
    }
  }

  private _execute(opcodes: UpdatingOpcode[], handler: ExceptionHandler) {
    let frameStack = this.#frameStack;

    this.try(opcodes, { handler, unwind: true });

    while (!frameStack.isEmpty()) {
      let opcode = this.frame.nextStatement();

      if (opcode === undefined) {
        frameStack.pop();
        continue;
      }

      opcode.evaluate(this);
    }
  }

  private get frame() {
    return expect(this.#frameStack.current, 'bug: expected a frame');
  }

  deref<T>(reference: SomeReactive<T>): Result<T> {
    return readReactive(reference);
  }

  goto(index: number) {
    this.frame.goto(index);
  }

  try(ops: UpdatingOpcode[], handle: Nullable<HandleException>) {
    this.#frameStack.push(new UpdatingVMFrame(ops, handle));
  }

  unwind() {
    while (this.#frameStack.current) {
      const unwound = this.frame.unwind();
      this.#frameStack.pop();

      if (unwound) return;
    }

    // @fixme something more rationalized here
    throw Error(`unwind target not found`);
  }

  throw() {
    this.frame.handleException();
    this.#frameStack.pop();
  }
}

export interface InitialVmState {
  readonly pc: number;
  readonly scope: Scope;
  readonly dynamicScope: DynamicScope;
  readonly stack: unknown[];
  readonly unwind: UnwindTarget;
  readonly context: JitContext;
}

export interface VmStateSnapshot extends InitialVmState {
  readonly destructor: Destroyable;
}

export class ResumableVMState {
  readonly #state: VmStateSnapshot;
  constructor(state: VmStateSnapshot) {
    this.#state = state;
  }

  resume(runtime: RuntimeContext, builder: ElementBuilder): VM {
    return new VM(runtime, this.#state, builder);
  }
}

export abstract class BlockOpcode<Child extends UpdatingOpcode = UpdatingOpcode>
  implements UpdatingOpcode, BlockBounds
{
  #children: Child[];

  protected readonly bounds: LiveBlock;

  constructor(
    protected state: ResumableVMState,
    protected runtime: RuntimeContext,
    bounds: LiveBlock,
    children: Child[]
  ) {
    this.#children = children;
    this.bounds = bounds;
  }

  get children() {
    return this.#children;
  }

  protected updateChildren(children: Child[]): Child[] {
    this.#children = children;
    return children;
  }

  parentElement() {
    return this.bounds.parentElement();
  }

  firstNode() {
    return this.bounds.firstNode();
  }

  lastNode() {
    return this.bounds.lastNode();
  }

  evaluate(vm: UpdatingVM) {
    vm.try(this.children, null);
  }
}

export class TryOpcode extends BlockOpcode implements ExceptionHandler {
  public type = 'try';

  protected declare bounds: UpdatableBlock; // Hides property on base class
  readonly #unwindTarget: boolean;

  constructor(
    ...args: [...ConstructorParameters<typeof BlockOpcode>, options: { unwindTarget: boolean }]
  ) {
    const { unwindTarget } = args.pop() as { unwindTarget: boolean };
    super(...(args as unknown as ConstructorParameters<typeof BlockOpcode>));
    this.#unwindTarget = unwindTarget;
  }

  override evaluate(vm: UpdatingVM) {
    vm.try(this.children, { handler: this, unwind: this.#unwindTarget });
  }

  handleException() {
    let { state, bounds, runtime } = this;

    destroyChildren(this);

    let elementStack = NewElementBuilder.resume(runtime.env, bounds);
    let vm = state.resume(runtime, elementStack);

    let updating: UpdatingOpcode[] = [];
    let children = this.updateChildren([]);

    let result = vm.execute((vm) => {
      vm.start();
      vm.start(this);

      vm.pushUpdating(updating);
      vm.updateWith(this);
      vm.pushUpdating(children);
    });

    associateDestroyableChild(this, result.drop);
  }
}

export class ListItemOpcode extends TryOpcode {
  public retained = false;
  public index = -1;
  #memo: SomeReactive;

  constructor(
    state: ResumableVMState,
    runtime: RuntimeContext,
    bounds: UpdatableBlock,
    public key: unknown,
    memo: SomeReactive,
    public value: SomeReactive
  ) {
    super(state, runtime, bounds, [], { unwindTarget: false });
    this.#memo = memo;
  }

  updateReferences(item: OpaqueIterationItem) {
    this.retained = true;
    updateRef(this.value, item.value);
    updateRef(this.#memo, item.memo);
  }

  shouldRemove(): boolean {
    return !this.retained;
  }

  reset() {
    this.retained = false;
  }
}

export class ListBlockOpcode extends BlockOpcode<ListItemOpcode> {
  readonly type = 'list-block';

  #opcodeMap = new Map<unknown, ListItemOpcode>();
  #marker: SimpleComment | null = null;
  #lastIterator: Result<OpaqueIterator>;

  protected declare readonly bounds: LiveBlockList;

  constructor(
    state: ResumableVMState,
    runtime: RuntimeContext,
    bounds: LiveBlockList,
    children: ListItemOpcode[],
    private iterableRef: SomeReactive<OpaqueIterator>
  ) {
    super(state, runtime, bounds, children);
    this.#lastIterator = readReactive(iterableRef);
  }

  initializeChild(opcode: ListItemOpcode) {
    opcode.index = this.children.length - 1;
    this.#opcodeMap.set(opcode.key, opcode);
  }

  override evaluate(vm: UpdatingVM) {
    let iterator = readReactive(this.iterableRef);

    if (this.#lastIterator.type !== iterator.type || this.#lastIterator.value !== iterator.value) {
      let { bounds } = this;
      let { dom } = vm;

      let marker = (this.#marker = dom.createComment(''));
      dom.insertAfter(
        bounds.parentElement(),
        marker,
        expect(bounds.lastNode(), "can't insert after an empty bounds")
      );

      if (iterator.type === 'err') {
        // @fixme
        throw Error('unimplemented: list block iterator error');
      }

      this.#sync(iterator.value);

      this.parentElement().removeChild(marker);
      this.#marker = null;
      this.#lastIterator = iterator;
    }

    // Run now-updated updating opcodes
    super.evaluate(vm);
  }

  #sync(iterator: OpaqueIterator) {
    const itemMap = this.#opcodeMap;

    let currentOpcodeIndex = 0;
    let seenIndex = 0;

    const children = this.children;
    this.bounds.boundList = this.updateChildren([]);

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let item = iterator.next();

      if (item === null) break;

      let opcode = children[currentOpcodeIndex];
      let { key } = item;

      // Items that have already been found and moved will already be retained, we can continue
      // until we find the next unretained item
      while (opcode !== undefined && opcode.retained === true) {
        opcode = children[++currentOpcodeIndex];
      }

      if (opcode !== undefined && opcode.key === key) {
        this.retainItem(opcode, item);
        currentOpcodeIndex++;
      } else if (itemMap.has(key)) {
        let itemOpcode = itemMap.get(key)!;

        // The item opcode was seen already, so we should move it.
        if (itemOpcode.index < seenIndex) {
          this.moveItem(itemOpcode, item, opcode);
        } else {
          // Update the seen index, we are going to be moving this item around so any other items
          // that come before it will likely need to move as well.
          seenIndex = itemOpcode.index;

          let seenUnretained = false;

          // iterate through all of the opcodes between the current position and the position of the
          // item's opcode, and determine if they are all retained.
          for (let i = currentOpcodeIndex + 1; i < seenIndex; i++) {
            if (unwrap(children[i]).retained === false) {
              seenUnretained = true;
              break;
            }
          }

          // If we have seen only retained opcodes between this and the matching opcode, it means
          // that all the opcodes in between have been moved already, and we can safely retain this
          // item's opcode.
          if (seenUnretained === false) {
            this.retainItem(itemOpcode, item);
            currentOpcodeIndex = seenIndex + 1;
          } else {
            this.moveItem(itemOpcode, item, opcode);
            currentOpcodeIndex++;
          }
        }
      } else {
        this.insertItem(item, opcode);
      }
    }

    for (const opcode of children) {
      if (opcode.retained === false) {
        this.deleteItem(opcode);
      } else {
        opcode.reset();
      }
    }
  }

  private retainItem(opcode: ListItemOpcode, item: OpaqueIterationItem) {
    if (LOCAL_DEBUG) {
      logStep!('list-updates', ['retain', item.key]);
    }

    let { children } = this;

    opcode.updateReferences(item);

    opcode.index = children.length;
    children.push(opcode);
  }

  private insertItem(item: OpaqueIterationItem, before: ListItemOpcode | undefined) {
    if (LOCAL_DEBUG) {
      logStep!('list-updates', ['insert', item.key]);
    }

    const opcodeMap = this.#opcodeMap;
    let { bounds, state, runtime, children } = this;
    let { key } = item;
    let nextSibling = before === undefined ? this.#marker : before.firstNode();

    let elementStack = NewElementBuilder.forInitialRender(runtime.env, {
      element: bounds.parentElement(),
      nextSibling,
    });

    let vm = state.resume(runtime, elementStack);

    vm.execute((vm) => {
      vm.start();
      vm.pushUpdating();
      let opcode = vm.enterItem(item);

      opcode.index = children.length;
      children.push(opcode);
      opcodeMap.set(key, opcode);
      associateDestroyableChild(this, opcode);
    });
  }

  private moveItem(
    opcode: ListItemOpcode,
    item: OpaqueIterationItem,
    before: ListItemOpcode | undefined
  ) {
    let { children } = this;

    opcode.updateReferences(item);

    let currentSibling, nextSibling;

    if (before === undefined) {
      moveBounds(opcode, this.#marker);
    } else {
      currentSibling = opcode.lastNode().nextSibling;
      nextSibling = before.firstNode();

      // Items are moved throughout the algorithm, so there are cases where the the items already
      // happen to be siblings (e.g. an item in between was moved before this move happened). Check
      // to see if they are siblings first before doing the move.
      if (currentSibling !== nextSibling) {
        moveBounds(opcode, nextSibling);
      }
    }

    opcode.index = children.length;
    children.push(opcode);

    if (LOCAL_DEBUG) {
      let type = currentSibling && currentSibling === nextSibling ? 'move-retain' : 'move';
      logStep!('list-updates', [type, item.key]);
    }
  }

  private deleteItem(opcode: ListItemOpcode) {
    if (LOCAL_DEBUG) {
      logStep!('list-updates', ['delete', opcode.key]);
    }

    destroy(opcode);
    clear(opcode);
    this.#opcodeMap.delete(opcode.key);
  }
}

class UpdatingVMFrame {
  #current = 0;
  readonly #ops: readonly UpdatingOpcode[];
  readonly #error: Nullable<HandleException>;

  constructor(ops: UpdatingOpcode[], handleException: Nullable<HandleException>) {
    this.#ops = ops;
    this.#error = handleException;
  }

  goto(index: number) {
    this.#current = index;
  }

  nextStatement(): UpdatingOpcode | undefined {
    return this.#ops[this.#current++];
  }

  /**
   * unwind returns true if the frame is an unwind target (and therefore unwinding should stop at
   * this frame).
   */
  unwind(): boolean {
    if (this.#error) {
      this.#error.handler.handleException();
      if (this.#error.unwind) return true;
    }

    return false;
  }

  handleException(): void {
    if (this.#error) {
      this.#error.handler.handleException();
    }
  }
}
