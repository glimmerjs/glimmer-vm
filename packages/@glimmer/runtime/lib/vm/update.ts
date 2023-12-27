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
import type { OpaqueIterationItem, OpaqueIterator, Reference } from '@glimmer/reference';
import { associateDestroyableChild, destroy, destroyChildren } from '@glimmer/destroyable';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { updateRef, valueForRef } from '@glimmer/reference';
import { expect, logStep, Stack } from '@glimmer/util';
import { debug, resetTracking } from '@glimmer/validator';

import type { InternalVM, VmInitCallback } from './append';
import type { LiveBlockList } from './element-builder';

import { clear, move as moveBounds } from '../bounds';
import { NewElementBuilder } from './element-builder';

export class UpdatingVM implements IUpdatingVM {
  public env: Environment;
  public dom: GlimmerTreeChanges;
  public alwaysRevalidate: boolean;

  private frameStack: Stack<UpdatingVMFrame> = new Stack<UpdatingVMFrame>();

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

  private _execute(opcodes: UpdatingOpcode[], handler: ExceptionHandler) {
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

  try(ops: UpdatingOpcode[], handler: Nullable<ExceptionHandler>) {
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
  constructor(
    readonly state: VMState,
    private resumeCallback: VmInitCallback
  ) {}

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

    let result = vm.execute((vm) => {
      vm.pushUpdating(updating);
      vm.updateWith(this);
      vm.pushUpdating(children);
    });

    associateDestroyableChild(this, result.drop);
  }
}

export class ListItemOpcode extends TryOpcode {
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
    updateRef(this.value, item.value);
    updateRef(this.memo, item.memo);
  }
}

export class ListBlockOpcode extends BlockOpcode {
  public type = 'list-block';
  public declare children: ListItemOpcode[];

  private opcodeMap = new Map<unknown, ListItemOpcode>();
  private marker: SimpleComment | null = null;
  private lastIterator: OpaqueIterator;

  protected declare readonly bounds: LiveBlockList;

  constructor(
    state: ResumableVMState,
    runtime: RuntimeContext,
    bounds: LiveBlockList,
    children: ListItemOpcode[],
    private iterableRef: Reference<OpaqueIterator>
  ) {
    super(state, runtime, bounds, children);
    this.lastIterator = valueForRef(iterableRef);
  }

  initializeChild(opcode: ListItemOpcode) {
    opcode.index = this.children.length - 1;
    this.opcodeMap.set(opcode.key, opcode);
  }

  override evaluate(vm: UpdatingVM) {
    let iterator = valueForRef(this.iterableRef);

    if (this.lastIterator !== iterator) {
      let { bounds } = this;
      let { dom } = vm;

      let marker = (this.marker = dom.createComment(''));
      dom.insertAfter(
        bounds.parentElement(),
        marker,
        expect(bounds.lastNode(), "can't insert after an empty bounds")
      );

      this.sync(iterator);

      this.parentElement().removeChild(marker);
      this.marker = null;
      this.lastIterator = iterator;
    }

    // Run now-updated updating opcodes
    super.evaluate(vm);
  }

  private sync(iterator: OpaqueIterator) {
    let { opcodeMap: itemMap, children } = this;

    this.children = this.bounds.boundList = [];

    let items: OpaqueIterationItem[] = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let item = iterator.next();
      if (item === null) break;
      items.push(item);
    }

    const existingKeys = new Set(itemMap.keys());
    const updatingKeys = new Set(items.map((item) => item.key));
    const keysToRemove = [...existingKeys].filter((key) => !updatingKeys.has(key));
    const removedIndexes = [];

    if (keysToRemove.length === existingKeys.size) {
      this.deleteAllItems(children);
      children.splice(0, children.length);
    } else {
      for (const key of keysToRemove) {
        const opcode = itemMap.get(key)!;
        removedIndexes.push(opcode.index);
        this.deleteItem(opcode);
        children.splice(children.indexOf(opcode), 1);
      }
    }

    for (const value of children) {
      removedIndexes.forEach((index) => {
        if (value.index > index) {
          value.index--;
        }
      });
    }

    items.forEach((item, index) => {
      const opcode = itemMap.get(item.key);
      if (opcode !== undefined) {
        if (opcode.index !== index) {
          this.moveItem(opcode, item, index === 0 ? children[index] : undefined);
        } else {
          this.retainItem(opcode, item);
        }
      } else {
        this.insertItem(item, undefined);
      }
    });
  }

  private retainItem(opcode: ListItemOpcode, item: OpaqueIterationItem) {
    if (LOCAL_DEBUG) {
      logStep!('list-updates', ['retain', item.key]);
    }

    let { children } = this;

    updateRef(opcode.memo, item.memo);
    updateRef(opcode.value, item.value);
    children.push(opcode);
  }

  private insertItem(item: OpaqueIterationItem, before: ListItemOpcode | undefined) {
    if (LOCAL_DEBUG) {
      logStep!('list-updates', ['insert', item.key]);
    }

    let { opcodeMap, bounds, state, runtime, children } = this;
    let { key } = item;
    let nextSibling = before === undefined ? this.marker : before.firstNode();

    let elementStack = NewElementBuilder.forInitialRender(runtime.env, {
      element: bounds.parentElement(),
      nextSibling,
    });

    let vm = state.resume(runtime, elementStack);

    vm.execute((vm) => {
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

    updateRef(opcode.memo, item.memo);
    updateRef(opcode.value, item.value);

    let currentSibling, nextSibling;

    if (before === undefined) {
      moveBounds(opcode, this.marker);
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

    if (LOCAL_DEBUG) {
      let type = currentSibling && currentSibling === nextSibling ? 'move-retain' : 'move';
      logStep!('list-updates', [type, item.key]);
    }
  }

  private deleteAllItems(opcodes: ListItemOpcode[]) {
    if (LOCAL_DEBUG) {
      for (const opcode of opcodes) {
        logStep!('list-updates', ['delete', opcode.key]);
      }
    }
    for (const opcode of opcodes) {
      destroy(opcode);
      clear(opcode);
    }
    this.opcodeMap.clear();
  }

  private deleteItem(opcode: ListItemOpcode) {
    if (LOCAL_DEBUG) {
      logStep!('list-updates', ['delete', opcode.key]);
    }

    destroy(opcode);
    clear(opcode);
    this.opcodeMap.delete(opcode.key);
  }
}

class UpdatingVMFrame {
  private current = 0;

  constructor(
    private ops: UpdatingOpcode[],
    private exceptionHandler: Nullable<ExceptionHandler>
  ) {}

  goto(index: number) {
    this.current = index;
  }

  nextStatement(): UpdatingOpcode | undefined {
    return this.ops[this.current++];
  }

  handleException() {
    if (this.exceptionHandler) {
      this.exceptionHandler.handleException();
    }
  }
}
