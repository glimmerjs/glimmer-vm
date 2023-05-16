import { associateDestroyableChild } from '@glimmer/destroyable';
import { assertGlobalContextWasSet } from '@glimmer/global-context';
import type {
  CompilableTemplate,
  CompileTimeCompilationContext,
  Destroyable,
  DynamicScope,
  ElementBuilder,
  Environment,
  Nullable,
  Owner,
  RenderResult,
  ResolutionTimeConstants,
  RichIteratorResult,
  RuntimeConstants,
  RuntimeContext,
  RuntimeHeap,
  RuntimeProgram,
  Scope,
  UpdatingOpcode,
  VM as PublicVM,
} from '@glimmer/interfaces';
import { LOCAL_SHOULD_LOG } from '@glimmer/local-debug-flags';
import {
  createIteratorItemRef,
  type OpaqueIterationItem,
  type OpaqueIterator,
  type Reference,
  UNDEFINED_REFERENCE,
} from '@glimmer/reference';
import { assert, expect, LOCAL_LOGGER, reverse, Stack, unwrap, unwrapHandle } from '@glimmer/util';
import { beginTrackFrame, endTrackFrame, resetTracking } from '@glimmer/validator';
import {
  $fp,
  $pc,
  $s0,
  $s1,
  $sp,
  $t0,
  $t1,
  $v0,
  isLowLevelRegister,
  type MachineRegister,
  type Register,
  type SyscallRegister,
} from '@glimmer/vm';

import {
  BeginTrackFrameOpcode,
  EndTrackFrameOpcode,
  JumpIfNotModifiedOpcode,
} from '../compiled/opcodes/vm';
import { APPEND_OPCODES, type DebugState } from '../opcodes';
import { ScopeImpl } from '../scope';
import { ARGS, CONSTANTS, INNER_VM } from '../symbols';
import { VMArgumentsImpl } from './arguments';
import type { LiveBlockList } from './element-builder';
import { LowLevelVM, type Externs } from './low-level';
import RenderResultImpl from './render-result';
import EvaluationStackImpl, { type EvaluationStack } from './stack';
import {
  type BlockOpcode,
  ListBlockOpcode,
  ListItemOpcode,
  type ResumableVMState,
  ResumableVMStateImpl,
  TryOpcode,
  type VMState,
} from './update';

/**
 * This interface is used by internal opcodes, and is more stable than
 * the implementation of the Append VM itself.
 */
export interface InternalVM {
  readonly [CONSTANTS]: RuntimeConstants & ResolutionTimeConstants;
  readonly [ARGS]: VMArgumentsImpl;

  readonly env: Environment;
  readonly stack: EvaluationStack;
  readonly runtime: RuntimeContext;
  readonly context: CompileTimeCompilationContext;

  loadValue(register: MachineRegister, value: number): void;
  loadValue(register: Register, value: unknown): void;
  loadValue(register: Register | MachineRegister, value: unknown): void;

  fetchValue(register: MachineRegister.ra | MachineRegister.pc): number;
  // TODO: Something better than a type assertion?
  fetchValue<T>(register: Register): T;
  fetchValue(register: Register): unknown;

  load(register: Register): void;
  fetch(register: Register): void;

  compile(block: CompilableTemplate): number;

  scope(): Scope;
  elements(): ElementBuilder;

  getOwner(): Owner;
  getSelf(): Reference;

  updateWith(opcode: UpdatingOpcode): void;

  associateDestroyable(d: Destroyable): void;

  beginCacheGroup(name?: string): void;
  commitCacheGroup(): void;

  /// Iteration ///

  enterList(iterableRef: Reference<OpaqueIterator>, offset: number): void;
  exitList(): void;
  enterItem(item: OpaqueIterationItem): ListItemOpcode;
  registerItem(item: ListItemOpcode): void;

  pushRootScope(size: number, owner: Owner): Scope;
  pushChildScope(): void;
  popScope(): void;
  pushScope(scope: Scope): void;

  dynamicScope(): DynamicScope;
  bindDynamicScope(names: string[]): void;
  pushDynamicScope(): void;
  popDynamicScope(): void;

  enter(args: number): void;
  exit(): void;

  goto(pc: number): void;
  call(handle: number): void;
  pushFrame(): void;

  referenceForSymbol(symbol: number): Reference;

  execute(initialize?: (vm: this) => void): RenderResult;
  pushUpdating(list?: UpdatingOpcode[]): void;
  next(): RichIteratorResult<null, RenderResult>;
}

class Stacks {
  readonly scope = new Stack<Scope>();
  readonly dynamicScope = new Stack<DynamicScope>();
  readonly updating = new Stack<UpdatingOpcode[]>();
  readonly cache = new Stack<JumpIfNotModifiedOpcode>();
  readonly list = new Stack<ListBlockOpcode>();
}

export interface DebugVM {
  readonly getStacks: (vm: VM) => Stacks;
  readonly destroyableStack: Stack<object>;
}

export class VM implements PublicVM, InternalVM {
  readonly #stacks = new Stacks();
  readonly #heap: RuntimeHeap;
  readonly #destructor: object;
  readonly #destroyableStack = new Stack<object>();
  readonly [CONSTANTS]: RuntimeConstants & ResolutionTimeConstants;
  readonly [ARGS]: VMArgumentsImpl;
  readonly [INNER_VM]: LowLevelVM;
  readonly #elementStack: ElementBuilder;

  declare readonly debug?: DebugVM;

  get stack(): EvaluationStack {
    return this[INNER_VM].stack as EvaluationStack;
  }

  /* Registers */

  get pc(): number {
    return this[INNER_VM].fetchRegister($pc);
  }

  public s0: unknown = null;
  public s1: unknown = null;
  public t0: unknown = null;
  public t1: unknown = null;
  public v0: unknown = null;

  // Fetch a value from a register onto the stack
  fetch(register: SyscallRegister): void {
    let value = this.fetchValue(register);

    this.stack.push(value);
  }

  // Load a value from the stack into a register
  load(register: SyscallRegister) {
    let value = this.stack.pop();

    this.loadValue(register, value);
  }

  // Fetch a value from a register
  fetchValue(register: MachineRegister): number;
  fetchValue<T>(register: Register): T;
  fetchValue(register: Register | MachineRegister): unknown {
    if (isLowLevelRegister(register)) {
      return this[INNER_VM].fetchRegister(register);
    }

    switch (register) {
      case $s0:
        return this.s0;
      case $s1:
        return this.s1;
      case $t0:
        return this.t0;
      case $t1:
        return this.t1;
      case $v0:
        return this.v0;
    }
  }

  // Load a value into a register

  loadValue<T>(register: Register | MachineRegister, value: T): void {
    if (isLowLevelRegister(register)) {
      this[INNER_VM].loadRegister(register, value as any as number);
    }

    switch (register) {
      case $s0:
        this.s0 = value;
        break;
      case $s1:
        this.s1 = value;
        break;
      case $t0:
        this.t0 = value;
        break;
      case $t1:
        this.t1 = value;
        break;
      case $v0:
        this.v0 = value;
        break;
    }
  }

  /**
   * Migrated to Inner
   */

  // Start a new frame and save $ra and $fp on the stack
  pushFrame() {
    this[INNER_VM].pushFrame();
  }

  // Restore $ra, $sp and $fp
  popFrame() {
    this[INNER_VM].popFrame();
  }

  // Jump to an address in `program`
  goto(offset: number) {
    this[INNER_VM].goto(offset);
  }

  // Save $pc into $ra, then jump to a new address in `program` (jal in MIPS)
  call(handle: number) {
    this[INNER_VM].call(handle);
  }

  // Put a specific `program` address in $ra
  returnTo(offset: number) {
    this[INNER_VM].returnTo(offset);
  }

  // Return to the `program` address stored in $ra
  return() {
    this[INNER_VM].return();
  }

  /**
   * End of migrated.
   */

  constructor(
    readonly runtime: RuntimeContext,
    { pc, scope, dynamicScope, stack }: VMState,
    elementStack: ElementBuilder,
    readonly context: CompileTimeCompilationContext
  ) {
    this.#elementStack = elementStack;
    if (import.meta.env.DEV) {
      assertGlobalContextWasSet!();

      Object.defineProperty(this, 'debug', {
        enumerable: false,
        configurable: true,
        writable: false,
        value: {
          destroyableStack: this.#destroyableStack,
          getStacks: (vm) => vm.#stacks,
        } satisfies DebugVM,
      });
    }

    this.#resume = initVM(context);
    let evalStack = EvaluationStackImpl.restore(stack);

    assert(typeof pc === 'number', 'pc is a number');

    evalStack['_registers_'][$pc] = pc;
    evalStack['_registers_'][$sp] = stack.length - 1;
    evalStack['_registers_'][$fp] = -1;

    this.#heap = this.program.heap;
    this[CONSTANTS] = this.program.constants;
    this.#elementStack = elementStack;
    this.#stacks.scope.push(scope);
    this.#stacks.dynamicScope.push(dynamicScope);
    this[ARGS] = new VMArgumentsImpl();
    this[INNER_VM] = new LowLevelVM(
      evalStack,
      this.#heap,
      runtime.program,
      evalStack['_registers_'],
      import.meta.env.DEV
        ? ((): Externs | undefined => {
            const debug = APPEND_OPCODES.debug;
            return debug
              ? {
                  debugBefore: (opcode): DebugState => {
                    return debug.before(this, opcode);
                  },

                  debugAfter: (state): void => {
                    debug.after(this, state, unwrap(this.debug));
                  },
                }
              : undefined;
          })()
        : undefined
    );

    this.#destructor = {};
    this.#destroyableStack.push(this.#destructor);
  }

  static initial(
    runtime: RuntimeContext,
    context: CompileTimeCompilationContext,
    { handle, self, dynamicScope, treeBuilder, numSymbols, owner }: InitOptions
  ) {
    let scope = ScopeImpl.root(self, numSymbols, owner);
    let state = vmState(runtime.program.heap.getaddr(handle), scope, dynamicScope);
    let vm = initVM(context)(runtime, state, treeBuilder);
    vm.pushUpdating();
    return vm;
  }

  static empty(
    runtime: RuntimeContext,
    { handle, treeBuilder, dynamicScope, owner }: MinimalInitOptions,
    context: CompileTimeCompilationContext
  ) {
    let vm = initVM(context)(
      runtime,
      vmState(
        runtime.program.heap.getaddr(handle),
        ScopeImpl.root(UNDEFINED_REFERENCE, 0, owner),
        dynamicScope
      ),
      treeBuilder
    );
    vm.pushUpdating();
    return vm;
  }

  readonly #resume: VmInitCallback;

  compile(block: CompilableTemplate): number {
    let handle = unwrapHandle(block.compile(this.context));

    return handle;
  }

  get program(): RuntimeProgram {
    return this.runtime.program;
  }

  get env(): Environment {
    return this.runtime.env;
  }

  captureState(args: number, pc = this[INNER_VM].fetchRegister($pc)): VMState {
    return {
      pc,
      scope: this.scope(),
      dynamicScope: this.dynamicScope(),
      stack: this.stack.capture(args),
    };
  }

  capture(args: number, pc = this[INNER_VM].fetchRegister($pc)): ResumableVMState {
    return new ResumableVMStateImpl(this.captureState(args, pc), this.#resume);
  }

  beginCacheGroup(name?: string) {
    let opcodes = this.updating();
    let guard = new JumpIfNotModifiedOpcode();

    opcodes.push(guard);
    opcodes.push(new BeginTrackFrameOpcode(name));
    this.#stacks.cache.push(guard);

    beginTrackFrame(name);
  }

  commitCacheGroup() {
    let opcodes = this.updating();
    let guard = expect(this.#stacks.cache.pop(), 'VM BUG: Expected a cache group');

    let tag = endTrackFrame();
    opcodes.push(new EndTrackFrameOpcode(guard));

    guard.finalize(tag, opcodes.length);
  }

  enter(args: number) {
    let updating: UpdatingOpcode[] = [];

    let state = this.capture(args);
    let block = this.elements().pushUpdatableBlock();

    let tryOpcode = new TryOpcode(state, this.runtime, block, updating);

    this.#didEnter(tryOpcode);
  }

  enterItem({ key, value, memo }: OpaqueIterationItem): ListItemOpcode {
    let { stack } = this;

    let valueRef = createIteratorItemRef(value);
    let memoRef = createIteratorItemRef(memo);

    stack.push(valueRef);
    stack.push(memoRef);

    let state = this.capture(2);
    let block = this.elements().pushUpdatableBlock();

    let opcode = new ListItemOpcode(state, this.runtime, block, key, memoRef, valueRef);
    this.#didEnter(opcode);

    return opcode;
  }

  registerItem(opcode: ListItemOpcode) {
    this.listBlock().initializeChild(opcode);
  }

  enterList(iterableRef: Reference<OpaqueIterator>, offset: number) {
    let updating: ListItemOpcode[] = [];

    let addr = this[INNER_VM].target(offset);
    let state = this.capture(0, addr);
    let list = this.elements().pushBlockList(updating) as LiveBlockList;

    let opcode = new ListBlockOpcode(state, this.runtime, list, updating, iterableRef);

    this.#stacks.list.push(opcode);

    this.#didEnter(opcode);
  }

  #didEnter(opcode: BlockOpcode) {
    this.associateDestroyable(opcode);
    this.#destroyableStack.push(opcode);
    this.updateWith(opcode);
    this.pushUpdating(opcode.children);
  }

  exit() {
    this.#destroyableStack.pop();
    this.elements().popBlock();
    this.popUpdating();
  }

  exitList() {
    this.exit();
    this.#stacks.list.pop();
  }

  pushUpdating(list: UpdatingOpcode[] = []): void {
    this.#stacks.updating.push(list);
  }

  popUpdating(): UpdatingOpcode[] {
    return expect(this.#stacks.updating.pop(), "can't pop an empty stack");
  }

  updateWith(opcode: UpdatingOpcode) {
    this.updating().push(opcode);
  }

  listBlock(): ListBlockOpcode {
    return expect(this.#stacks.list.current, 'expected a list block');
  }

  associateDestroyable(child: Destroyable): void {
    let parent = expect(this.#destroyableStack.current, 'Expected destructor parent');
    associateDestroyableChild(parent, child);
  }

  tryUpdating(): Nullable<UpdatingOpcode[]> {
    return this.#stacks.updating.current;
  }

  updating(): UpdatingOpcode[] {
    return expect(
      this.#stacks.updating.current,
      'expected updating opcode on the updating opcode stack'
    );
  }

  elements(): ElementBuilder {
    return this.#elementStack;
  }

  scope(): Scope {
    return expect(this.#stacks.scope.current, 'expected scope on the scope stack');
  }

  dynamicScope(): DynamicScope {
    return expect(
      this.#stacks.dynamicScope.current,
      'expected dynamic scope on the dynamic scope stack'
    );
  }

  pushChildScope() {
    this.#stacks.scope.push(this.scope().child());
  }

  pushDynamicScope(): DynamicScope {
    let child = this.dynamicScope().child();
    this.#stacks.dynamicScope.push(child);
    return child;
  }

  pushRootScope(size: number, owner: Owner): Scope {
    let scope = ScopeImpl.sized(size, owner);
    this.#stacks.scope.push(scope);
    return scope;
  }

  pushScope(scope: Scope) {
    this.#stacks.scope.push(scope);
  }

  popScope() {
    this.#stacks.scope.pop();
  }

  popDynamicScope() {
    this.#stacks.dynamicScope.pop();
  }

  /// SCOPE HELPERS

  getOwner(): Owner {
    return this.scope().owner;
  }

  getSelf(): Reference<any> {
    return this.scope().getSelf();
  }

  referenceForSymbol(symbol: number): Reference {
    return this.scope().getSymbol(symbol);
  }

  /// EXECUTION

  execute(initialize?: (vm: this) => void): RenderResult {
    if (import.meta.env.DEV) {
      let hasErrored = true;
      try {
        let value = this.#execute(initialize);

        // using a boolean here to avoid breaking ergonomics of "pause on uncaught exceptions"
        // which would happen with a `catch` + `throw`
        hasErrored = false;

        return value;
      } finally {
        if (hasErrored) {
          // If any existing blocks are open, due to an error or something like
          // that, we need to close them all and clean things up properly.
          let elements = this.elements();

          while (elements.hasBlocks) {
            elements.popBlock();
          }

          // eslint-disable-next-line no-console
          console.error(`\n\nError occurred:\n\n${resetTracking()}\n\n`);
        }
      }
    } else {
      return this.#execute(initialize);
    }
  }

  #execute(initialize?: (vm: this) => void): RenderResult {
    if (LOCAL_SHOULD_LOG) {
      LOCAL_LOGGER.log(`EXECUTING FROM ${this[INNER_VM].fetchRegister($pc)}`);
    }

    initialize?.(this);

    let result: RichIteratorResult<null, RenderResult>;

    do result = this.next();
    while (!result.done);

    return result.value;
  }

  next(): RichIteratorResult<null, RenderResult> {
    let { env } = this;
    let opcode = this[INNER_VM].nextStatement();
    let result: RichIteratorResult<null, RenderResult>;
    if (opcode !== null) {
      this[INNER_VM].evaluateOuter(opcode, this);
      result = { done: false, value: null };
    } else {
      // Unload the stack
      this.stack.reset();

      result = {
        done: true,
        value: new RenderResultImpl(
          env,
          this.popUpdating(),
          this.#elementStack.popBlock(),
          this.#destructor
        ),
      };
    }
    return result;
  }

  bindDynamicScope(names: string[]) {
    let scope = this.dynamicScope();

    for (const name of reverse(names)) {
      scope.set(name, this.stack.pop<Reference<unknown>>());
    }
  }
}

function vmState(pc: number, scope: Scope, dynamicScope: DynamicScope) {
  return {
    pc,
    scope,
    dynamicScope,
    stack: [],
  };
}

export interface MinimalInitOptions {
  handle: number;
  treeBuilder: ElementBuilder;
  dynamicScope: DynamicScope;
  owner: Owner;
}

export interface InitOptions extends MinimalInitOptions {
  self: Reference;
  numSymbols: number;
}

export type VmInitCallback = (
  this: void,
  runtime: RuntimeContext,
  state: VMState,
  builder: ElementBuilder
) => InternalVM;

function initVM(context: CompileTimeCompilationContext): VmInitCallback {
  return (runtime, state, builder) => new VM(runtime, state, builder, context);
}
