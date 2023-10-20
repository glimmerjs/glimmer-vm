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
  PartialScope,
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
import { LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';
import type { RuntimeOpImpl } from '@glimmer/program';
import {
  createIteratorItemRef,
  type OpaqueIterationItem,
  type OpaqueIterator,
  type Reference,
  UNDEFINED_REFERENCE,
} from '@glimmer/reference';
import {
  assert,
  expect,
  LOCAL_LOGGER,
  reverse,
  Stack,
  unreachable,
  unwrapHandle,
} from '@glimmer/util';
import { beginTrackFrame, endTrackFrame, resetTracking } from '@glimmer/validator';
import { $s0, $s1, $t0, $t1, $v0, isLowLevelRegister } from '@glimmer/vm';
import type { MachineRegister, Register, SyscallRegister } from '@glimmer/vm';

import {
  BeginTrackFrameOpcode,
  EndTrackFrameOpcode,
  JumpIfNotModifiedOpcode,
} from '../compiled/opcodes/vm';
import { APPEND_OPCODES, type DebugState } from '../opcodes';
import { PartialScopeImpl } from '../scope';
import { ARGS, CONSTANTS, DESTROYABLE_STACK, HEAP, STACKS } from '../symbols';
import { VMArgumentsImpl } from './arguments';
import type { LiveBlockList } from './element-builder';
import {
  LowLevelVM,
  type CleanStack,
  type InternalStack,
  type ArgumentsStack,
  type DebugStack,
} from './low-level';
import RenderResultImpl from './render-result';
import EvaluationStackImpl from './stack';
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
  readonly stack: CleanStack;

  /**
   * This stack is used for:
   *
   * - internal debugging infrastructure
   * - the implementation of `Args`
   * - the implementation of the VM's `next` method
   *
   * It should not be used for other purposes, as it exposes internal implementation details that
   * are not "stacky" behavior, which is not the dominant use-case for the stack (even internally),
   * and causes confusion.
   *
   * @premerge verify that this distinction is useful
   * @internal
   */
  readonly internalStack: InternalStack;
  readonly argumentsStack: ArgumentsStack;
  readonly runtime: RuntimeContext;
  readonly context: CompileTimeCompilationContext;

  readonly fp: number;
  readonly sp: number;

  loadValue(register: SyscallRegister, value: unknown): void;

  // TODO: Something better than a type assertion?
  fetchValue<T>(register: SyscallRegister): T;

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

  pushRootScope(size: number, owner: Owner): PartialScope;
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
  unwind(e: unknown): void;

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

export interface VmDebugState {
  readonly fp: number;
  readonly ra: number;
  readonly pc: number;
  readonly sp: number;
  readonly up: number;
  readonly stack: DebugStack;
}

export class VM implements PublicVM, InternalVM {
  private readonly [STACKS] = new Stacks();
  private readonly [HEAP]: RuntimeHeap;
  private readonly destructor: object;
  private readonly [DESTROYABLE_STACK] = new Stack<object>();
  readonly [CONSTANTS]: RuntimeConstants & ResolutionTimeConstants;
  readonly [ARGS]: VMArgumentsImpl;
  readonly #inner: LowLevelVM;

  get lowLevel(): LowLevelVM {
    return this.#inner;
  }

  get stack(): CleanStack {
    return this.#inner.stack;
  }

  get internalStack(): InternalStack {
    return this.#inner.internalStack;
  }

  get argumentsStack(): ArgumentsStack {
    return this.#inner.forArguments;
  }

  /* Registers */

  get sp(): number {
    return this.#inner.sp;
  }

  get fp(): number {
    return this.#inner.fp;
  }

  get debug(): VmDebugState {
    if (import.meta.env.DEV) {
      let inner = this.#inner;

      return {
        get stack() {
          return inner.debug.stack;
        },
        get fp() {
          return inner.debug.registers.fp;
        },
        get ra() {
          return inner.debug.registers.ra;
        },
        get pc() {
          return inner.debug.registers.pc;
        },
        get sp() {
          return inner.debug.registers.sp;
        },
        get up() {
          return inner.debug.registers.up;
        },
      };
    }

    unreachable(`BUG: Don't call 'vm.debug' without checking import.meta.env.DEV`);
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

  /**
   * Fetch a value from a high-level register
   */
  fetchValue<T>(register: SyscallRegister): T {
    switch (register) {
      case $s0:
        return this.s0 as T;
      case $s1:
        return this.s1 as T;
      case $t0:
        return this.t0 as T;
      case $t1:
        return this.t1 as T;
      case $v0:
        return this.v0 as T;
      default:
        unreachable(`BUG: Cannot fetch from register ${register}`);
    }
  }

  // Load a value into a register

  loadValue<T>(register: Register | MachineRegister, value: T): void {
    assert(!isLowLevelRegister(register), `BUG: Cannot load into a low-level register`);

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
    this.#inner.pushFrame();
  }

  // Restore $ra, $sp and $fp
  popFrame() {
    this.#inner.popFrame();
  }

  // Jump to an address in `program`
  goto(offset: number) {
    this.#inner.goto(offset);
  }

  // Save $pc into $ra, then jump to a new address in `program` (jal in MIPS)
  call(handle: number) {
    this.#inner.call(handle);
  }

  // Put a specific `program` address in $ra
  returnTo(offset: number) {
    this.#inner.returnTo(offset);
  }

  // Return to the `program` address stored in $ra
  return() {
    this.#inner.return();
  }

  /**
   * End of migrated.
   */

  constructor(
    readonly runtime: RuntimeContext,
    { pc, scope, dynamicScope, stack }: VMState,
    private readonly elementStack: ElementBuilder,
    readonly context: CompileTimeCompilationContext
  ) {
    if (import.meta.env.DEV) {
      assertGlobalContextWasSet!();
    }

    this.resume = initVM(context);
    assert(typeof pc === 'number', 'pc is a number');
    let evalStack = EvaluationStackImpl.restore(stack, pc);

    this[HEAP] = this.program.heap;
    this[CONSTANTS] = this.program.constants;
    this.elementStack = elementStack;
    this[STACKS].scope.push(scope);
    this[STACKS].dynamicScope.push(dynamicScope);
    this[ARGS] = new VMArgumentsImpl();
    this.#inner = LowLevelVM.create(
      evalStack,
      this[HEAP],
      runtime.program,
      {
        debugBefore: (opcode: RuntimeOpImpl): DebugState => {
          return APPEND_OPCODES.debugBefore(this, opcode);
        },

        debugAfter: (state: DebugState): void => {
          APPEND_OPCODES.debugAfter(this, state);
        },
      },
      evalStack.registers
    );

    this.destructor = {};
    this[DESTROYABLE_STACK].push(this.destructor);
  }

  static initial(
    runtime: RuntimeContext,
    context: CompileTimeCompilationContext,
    { handle, self, dynamicScope, treeBuilder, numSymbols, owner }: InitOptions
  ) {
    let scope = PartialScopeImpl.root(self, numSymbols, owner);
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
        PartialScopeImpl.root(UNDEFINED_REFERENCE, 0, owner),
        dynamicScope
      ),
      treeBuilder
    );
    vm.pushUpdating();
    return vm;
  }

  private resume: VmInitCallback;

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

  unwind(e: unknown) {
    this.#inner.catch(e);
  }

  captureState(args: number, pc = this.#inner.pc): VMState {
    return {
      pc,
      scope: this.scope(),
      dynamicScope: this.dynamicScope(),
      stack: this.argumentsStack.capture(args),
    };
  }

  capture(args: number, pc = this.#inner.pc): ResumableVMState {
    return new ResumableVMStateImpl(this.captureState(args, pc), this.resume);
  }

  beginCacheGroup(name?: string) {
    let opcodes = this.updating();
    let guard = new JumpIfNotModifiedOpcode();

    opcodes.push(guard);
    opcodes.push(new BeginTrackFrameOpcode(name));
    this[STACKS].cache.push(guard);

    beginTrackFrame(name);
  }

  commitCacheGroup() {
    let opcodes = this.updating();
    let guard = expect(this[STACKS].cache.pop(), 'VM BUG: Expected a cache group');

    let tag = endTrackFrame();
    opcodes.push(new EndTrackFrameOpcode(guard));

    guard.finalize(tag, opcodes.length);
  }

  enter(args: number) {
    let updating: UpdatingOpcode[] = [];

    let state = this.capture(args);
    let block = this.elements().pushUpdatableBlock();

    let tryOpcode = new TryOpcode(state, this.runtime, block, updating);

    this.didEnter(tryOpcode);
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
    this.didEnter(opcode);

    return opcode;
  }

  registerItem(opcode: ListItemOpcode) {
    this.listBlock().initializeChild(opcode);
  }

  enterList(iterableRef: Reference<OpaqueIterator>, relativeStart: number) {
    let updating: ListItemOpcode[] = [];

    let addr = this.#inner.target(relativeStart);
    let state = this.capture(0, addr);
    let list = this.elements().pushBlockList(updating) as LiveBlockList;

    let opcode = new ListBlockOpcode(state, this.runtime, list, updating, iterableRef);

    this[STACKS].list.push(opcode);

    this.didEnter(opcode);
  }

  private didEnter(opcode: BlockOpcode) {
    this.associateDestroyable(opcode);
    this[DESTROYABLE_STACK].push(opcode);
    this.updateWith(opcode);
    this.pushUpdating(opcode.children);
  }

  exit() {
    this[DESTROYABLE_STACK].pop();
    this.elements().popBlock();
    this.popUpdating();
  }

  exitList() {
    this.exit();
    this[STACKS].list.pop();
  }

  pushUpdating(list: UpdatingOpcode[] = []): void {
    this[STACKS].updating.push(list);
  }

  popUpdating(): UpdatingOpcode[] {
    return expect(this[STACKS].updating.pop(), "can't pop an empty stack");
  }

  updateWith(opcode: UpdatingOpcode) {
    this.updating().push(opcode);
  }

  listBlock(): ListBlockOpcode {
    return expect(this[STACKS].list.current, 'expected a list block');
  }

  associateDestroyable(child: Destroyable): void {
    let parent = expect(this[DESTROYABLE_STACK].current, 'Expected destructor parent');
    associateDestroyableChild(parent, child);
  }

  tryUpdating(): Nullable<UpdatingOpcode[]> {
    return this[STACKS].updating.current;
  }

  updating(): UpdatingOpcode[] {
    return expect(
      this[STACKS].updating.current,
      'expected updating opcode on the updating opcode stack'
    );
  }

  elements(): ElementBuilder {
    return this.elementStack;
  }

  scope(): Scope {
    return expect(this[STACKS].scope.current, 'expected scope on the scope stack');
  }

  dynamicScope(): DynamicScope {
    return expect(
      this[STACKS].dynamicScope.current,
      'expected dynamic scope on the dynamic scope stack'
    );
  }

  pushChildScope() {
    this[STACKS].scope.push(this.scope().child());
  }

  pushDynamicScope(): DynamicScope {
    let child = this.dynamicScope().child();
    this[STACKS].dynamicScope.push(child);
    return child;
  }

  pushRootScope(size: number, owner: Owner): PartialScope {
    let scope = PartialScopeImpl.sized(size, owner);
    this[STACKS].scope.push(scope);
    return scope;
  }

  pushScope(scope: Scope) {
    this[STACKS].scope.push(scope);
  }

  popScope() {
    this[STACKS].scope.pop();
  }

  popDynamicScope() {
    this[STACKS].dynamicScope.pop();
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
        let value = this._execute(initialize);

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
      return this._execute(initialize);
    }
  }

  private _execute(initialize?: (vm: this) => void): RenderResult {
    if (LOCAL_TRACE_LOGGING) {
      LOCAL_LOGGER.debug(`EXECUTING FROM ${this.#inner.debug.registers.pc}`);
    }

    if (initialize) initialize(this);

    let result: RichIteratorResult<null, RenderResult>;

    do result = this.next();
    while (!result.done);

    return result.value;
  }

  next(): RichIteratorResult<null, RenderResult> {
    let { env, elementStack } = this;
    let opcode = this.#inner.nextStatement();
    let result: RichIteratorResult<null, RenderResult>;
    if (opcode !== null) {
      this.#inner.evaluateOuter(opcode, this);
      result = { done: false, value: null };
    } else {
      // Unload the stack
      this.internalStack.reset();

      result = {
        done: true,
        value: new RenderResultImpl(
          env,
          this.popUpdating(),
          elementStack.popBlock(),
          this.destructor
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
