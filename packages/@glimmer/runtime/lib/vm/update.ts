import { associateDestroyableChild, destroy, destroyChildren } from '@glimmer/destroyable';
import type {
  Bounds,
  DynamicScope,
  ElementBuilder,
  Environment,
  ExceptionHandler,
  GlimmerTreeChanges,
  LiveBlock,
  Nullable,
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
  type Reference,
  updateRef,
  valueForRef,
} from '@glimmer/reference';
import { expect, logStep, Stack, unwrap } from '@glimmer/util';
import { debug, resetTracking } from '@glimmer/validator';

import { clear, move as moveBounds } from '../bounds';
import type { InternalVM, VmInitCallback } from './append';
import { type LiveBlockList, NewElementBuilder } from './element-builder';

export class UpdatingVM implements IUpdatingVM {
  public env: Environment;
  public dom: GlimmerTreeChanges;
  public alwaysRevalidate: boolean;

  private frameStack: Stack<UpdatingVMFrame> = new Stack<UpdatingVMFrame>();

  constructor(
    environment: Environment,
    { alwaysRevalidate = false }: { alwaysRevalidate?: boolean } = {}
  ) {
    this.env = environment;
    this.dom = environment.getDOM();
    this.alwaysRevalidate = alwaysRevalidate;
  }

  execute(opcodes: readonly UpdatingOpcode[], handler: ExceptionHandler) {
    if (import.meta.env.DEV) {
      let hasErrored = true;
      try {
        debug.runInTrackingTransaction!(
          () => this._execute(opcodes, handler),
          '- While rendering:'
        );

        // using a boolean here to avoid breaking ergonomics of "pause on uncaught exceptions"
        // which would happen with a `catch` + `throw`
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

  private _execute(opcodes: readonly UpdatingOpcode[], handler: ExceptionHandler) {
    let { frameStack } = this;

    this.try(opcodes, handler);

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
    return expect(this.frameStack.current, 'bug: expected a frame');
  }

  goto(index: number) {
    this.frame.goto(index);
  }

  try(ops: readonly UpdatingOpcode[], handler: Nullable<ExceptionHandler>) {
    this.frameStack.push(new UpdatingVMFrame(ops, handler));
  }

  throw() {
    this.frame.handleException();
    this.frameStack.pop();
  }
}

export interface VMState {
  readonly pc: number;
  readonly scope: Scope;
  readonly dynamicScope: DynamicScope;
  readonly stack: unknown[];
}

export interface ResumableVMState {
  resume(runtime: RuntimeContext, builder: ElementBuilder): InternalVM;
}

export class ResumableVMStateImpl implements ResumableVMState {
  constructor(readonly state: VMState, private resumeCallback: VmInitCallback) {}

  resume(runtime: RuntimeContext, builder: ElementBuilder): InternalVM {
    return this.resumeCallback(runtime, this.state, builder);
  }
}

export abstract class BlockOpcode implements UpdatingOpcode, Bounds {
  public children: UpdatingOpcode[];

  protected readonly bounds: LiveBlock;

  constructor(
    protected state: ResumableVMState,
    protected runtime: RuntimeContext,
    bounds: LiveBlock,
    children: UpdatingOpcode[]
  ) {
    this.children = children;
    this.bounds = bounds;
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

  override evaluate(vm: UpdatingVM) {
    vm.try(this.children, this);
  }

  handleException() {
    let { state, bounds, runtime } = this;

    destroyChildren(this);

    let elementStack = NewElementBuilder.resume(runtime.env, bounds);
    let vm = state.resume(runtime, elementStack);

    let updating: UpdatingOpcode[] = [];
    let children = (this.children = []);

    let result = vm._execute_((vm) => {
      vm._pushUpdating_(updating);
      vm._updateWith_(this);
      vm._pushUpdating_(children);
    });

    result._link_(this);
  }
}

export class ListItemOpcode extends TryOpcode {
  public retained = false;
  public index = -1;

  constructor(
    state: ResumableVMState,
    runtime: RuntimeContext,
    bounds: UpdatableBlock,
    public key: unknown,
    public memo: Reference,
    public value: Reference
  ) {
    super(state, runtime, bounds, []);
  }

  updateReferences(item: OpaqueIterationItem) {
    this.retained = true;
    updateRef(this.value, item.value);
    updateRef(this.memo, item.memo);
  }

  shouldRemove(): boolean {
    return !this.retained;
  }

  reset() {
    this.retained = false;
  }
}

export class ListBlockOpcode extends BlockOpcode {
  public type = 'list-block';
  public declare children: ListItemOpcode[];

  readonly #opcodeMap = new Map<unknown, ListItemOpcode>();
  #marker: SimpleComment | null = null;
  #lastIterator: OpaqueIterator;
  readonly #iterableRef: Reference<OpaqueIterator>;

  protected declare readonly bounds: LiveBlockList;

  constructor(
    state: ResumableVMState,
    runtime: RuntimeContext,
    bounds: LiveBlockList,
    children: ListItemOpcode[],
    iterableReference: Reference<OpaqueIterator>
  ) {
    super(state, runtime, bounds, children);
    this.#iterableRef = iterableReference;
    this.#lastIterator = valueForRef(iterableReference);
  }

  initializeChild(opcode: ListItemOpcode) {
    opcode.index = this.children.length - 1;
    this.#opcodeMap.set(opcode.key, opcode);
  }

  override evaluate(vm: UpdatingVM) {
    let iterator = valueForRef(this.#iterableRef);

    if (this.#lastIterator !== iterator) {
      let { bounds } = this;
      let { dom } = vm;

      let marker = (this.#marker = dom.createComment(''));
      dom.insertAfter(
        bounds.parentElement(),
        marker,
        expect(bounds.lastNode(), "can't insert after an empty bounds")
      );

      this.#sync(iterator);

      this.parentElement().removeChild(marker);
      this.#marker = null;
      this.#lastIterator = iterator;
    }

    // Run now-updated updating opcodes
    super.evaluate(vm);
  }

  #sync(iterator: OpaqueIterator) {
    let { children } = this;
    let itemMap = this.#opcodeMap;

    let currentOpcodeIndex = 0;
    let seenIndex = 0;

    this.children = this.bounds.boundList = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let item = iterator._next_();

      if (!item) break;

      let opcode = children[currentOpcodeIndex];
      let { key } = item;

      // Items that have already been found and moved will already be retained,
      // we can continue until we find the next unretained item
      while (opcode && opcode.retained) {
        opcode = children[++currentOpcodeIndex];
      }

      if (opcode && opcode.key === key) {
        this.#retainItem(opcode, item);
        currentOpcodeIndex++;
      } else if (itemMap.has(key)) {
        let itemOpcode = itemMap.get(key)!;

        // The item opcode was seen already, so we should move it.
        if (itemOpcode.index < seenIndex) {
          this.#moveItem(itemOpcode, item, opcode);
        } else {
          // Update the seen index, we are going to be moving this item around
          // so any other items that come before it will likely need to move as
          // well.
          seenIndex = itemOpcode.index;

          let seenUnretained = false;

          // iterate through all of the opcodes between the current position and
          // the position of the item's opcode, and determine if they are all
          // retained.
          for (let index = currentOpcodeIndex + 1; index < seenIndex; index++) {
            if (!unwrap(children[index]).retained) {
              seenUnretained = true;
              break;
            }
          }

          // If we have seen only retained opcodes between this and the matching
          // opcode, it means that all the opcodes in between have been moved
          // already, and we can safely retain this item's opcode.
          if (seenUnretained) {
            this.#moveItem(itemOpcode, item, opcode);
            currentOpcodeIndex++;
          } else {
            this.#retainItem(itemOpcode, item);
            currentOpcodeIndex = seenIndex + 1;
          }
        }
      } else {
        this.#insertItem(item, opcode);
      }
    }

    for (let opcode of children) {
      if (opcode.retained) {
        opcode.reset();
      } else {
        this.#deleteItem(opcode);
      }
    }
  }

  #retainItem(opcode: ListItemOpcode, item: OpaqueIterationItem) {
    if (import.meta.env.DEV && LOCAL_DEBUG) {
      logStep!('list-updates', ['retain', item.key]);
    }

    let { children } = this;

    updateRef(opcode.memo, item.memo);
    updateRef(opcode.value, item.value);
    opcode.retained = true;

    opcode.index = children.length;
    children.push(opcode);
  }

  #insertItem(item: OpaqueIterationItem, before: ListItemOpcode | undefined) {
    if (import.meta.env.DEV && LOCAL_DEBUG) {
      logStep!('list-updates', ['insert', item.key]);
    }

    let { bounds, state, runtime, children } = this;
    let opcodeMap = this.#opcodeMap;
    let { key } = item;
    let nextSibling = before === undefined ? this.#marker : before.firstNode();

    let elementStack = NewElementBuilder.forInitialRender(runtime.env, {
      element: bounds.parentElement(),
      nextSibling,
    });

    let vm = state.resume(runtime, elementStack);

    vm._execute_((vm) => {
      vm._pushUpdating_();
      let opcode = vm._enterItem_(item);

      opcode.index = children.length;
      children.push(opcode);
      opcodeMap.set(key, opcode);
      associateDestroyableChild(this, opcode);
    });
  }

  #moveItem(opcode: ListItemOpcode, item: OpaqueIterationItem, before: ListItemOpcode | undefined) {
    let { children } = this;

    updateRef(opcode.memo, item.memo);
    updateRef(opcode.value, item.value);
    opcode.retained = true;

    let currentSibling, nextSibling;

    if (before === undefined) {
      moveBounds(opcode, this.#marker);
    } else {
      currentSibling = opcode.lastNode().nextSibling;
      nextSibling = before.firstNode();

      // Items are moved throughout the algorithm, so there are cases where the
      // the items already happen to be siblings (e.g. an item in between was
      // moved before this move happened). Check to see if they are siblings
      // first before doing the move.
      if (currentSibling !== nextSibling) {
        moveBounds(opcode, nextSibling);
      }
    }

    opcode.index = children.length;
    children.push(opcode);

    if (import.meta.env.DEV && LOCAL_DEBUG) {
      let type = currentSibling && currentSibling === nextSibling ? 'move-retain' : 'move';
      logStep!('list-updates', [type, item.key]);
    }
  }

  #deleteItem(opcode: ListItemOpcode) {
    if (import.meta.env.DEV && LOCAL_DEBUG) {
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
  readonly #exceptionHandler: Nullable<ExceptionHandler>;

  constructor(ops: readonly UpdatingOpcode[], exceptionHandler: Nullable<ExceptionHandler>) {
    this.#ops = ops;
    this.#exceptionHandler = exceptionHandler;
  }

  goto(index: number) {
    this.#current = index;
  }

  nextStatement(): UpdatingOpcode | undefined {
    return this.#ops[this.#current++];
  }

  handleException() {
    if (this.#exceptionHandler) this.#exceptionHandler.handleException();
  }
}
