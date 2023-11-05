import type { SnapshottableVM, VmDebugState } from '@glimmer/debug';
import { associateDestroyableChild } from '@glimmer/destroyable';
import { assertGlobalContextWasSet } from '@glimmer/global-context';
import type {
  BlockMetadata,
  CleanStack,
  CompilableTemplate,
  Destroyable,
  DynamicScope,
  ElementBuilder,
  Environment,
  ErrorHandler,
  InternalStack,
  JitContext,
  Nullable,
  OkResult,
  Owner,
  PartialScope,
  ProgramConstants,
  RenderResult,
  Result,
  RichIteratorResult,
  RuntimeContext,
  RuntimeProgram,
  Scope,
  TargetState,
  UpdatingOpcode,
  VM as PublicVM,
} from '@glimmer/interfaces';
import { LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';
import {
  createIteratorItemRef,
  type OpaqueIterationItem,
  type OpaqueIterator,
  type SomeReactive,
  UNDEFINED_REFERENCE,
} from '@glimmer/reference';
import { readReactive } from '@glimmer/reference/lib/reference';
import {
  assert,
  BalancedStack,
  EarlyError,
  expect,
  LOCAL_LOGGER,
  mapResult,
  PresentStack,
  reverse,
  Stack,
  unreachable,
  unwrapHandle,
} from '@glimmer/util';
import { beginTrackFrame, endTrackFrame, resetTracking } from '@glimmer/validator';
import type { MachineRegister, Register, SyscallRegister } from '@glimmer/vm';
import { $s0, $s1, $t0, $t1, $v0, isLowLevelRegister } from '@glimmer/vm';

import {
  BeginTrackFrameOpcode,
  EndTrackFrameOpcode,
  JumpIfNotModifiedOpcode,
} from '../compiled/opcodes/vm';
import { PartialScopeImpl } from '../scope';
import { VMArgumentsImpl } from './arguments';
import { debugInit } from './debug/debug';
import type { LiveBlockList } from './element-builder';
import { type ArgumentsStack, LowLevelVM } from './low-level';
import RenderResultImpl from './render-result';
import EvaluationStackImpl from './stack';
import { UnwindTarget } from './unwind';
import {
  type BlockOpcode,
  type InitialVmState,
  ListBlockOpcode,
  ListItemOpcode,
  ResumableVMState,
  TryOpcode,
  type VmStateSnapshot,
} from './update';

type Handle = number;

class TemplateDebug {
  readonly #templates: Map<Handle, BlockMetadata> = new Map();
  #active: Handle[] = [];

  willCall(handle: Handle): void {
    this.#active.push(handle);
  }

  return(): void {
    this.#active.pop();
  }

  get active(): BlockMetadata | null {
    const current = this.#active.at(-1);
    return current ? this.#templates.get(current) ?? null : null;
  }

  register(handle: Handle, metadata: BlockMetadata): void {
    this.#templates.set(handle, metadata);
  }
}

class VMState {
  static initial(options: { scope: Scope; dynamicScope: DynamicScope }): VMState {
    return new VMState(
      PresentStack.initial(options.scope, 'scope stack'),
      PresentStack.initial(options.dynamicScope, 'dynamic scope stack'),
      Stack.empty('cache stack'),
      Stack.empty('list stack'),
      BalancedStack.empty('updating stack'),
      BalancedStack.empty('destructor stack')
    );
  }

  #scope: PresentStack<Scope>;
  #dynamicScope: PresentStack<DynamicScope>;
  #cache: Stack<JumpIfNotModifiedOpcode>;
  #list: Stack<ListBlockOpcode>;
  #updating: BalancedStack<UpdatingOpcode[]>;
  #destructors: BalancedStack<Destroyable>;

  constructor(
    scope: PresentStack<Scope>,
    dynamicScope: PresentStack<DynamicScope>,
    cache: Stack<JumpIfNotModifiedOpcode>,
    list: Stack<ListBlockOpcode>,
    updating: BalancedStack<UpdatingOpcode[]>,
    destructors: BalancedStack<Destroyable>
  ) {
    this.#scope = scope;
    this.#dynamicScope = dynamicScope;
    this.#cache = cache;
    this.#list = list;
    this.#updating = updating;
    this.#destructors = destructors;
  }

  get scope(): PresentStack<Scope> {
    return this.#scope;
  }

  get dynamicScope(): PresentStack<DynamicScope> {
    return this.#dynamicScope;
  }

  get cache(): Stack<JumpIfNotModifiedOpcode> {
    return this.#cache;
  }

  get list(): Stack<ListBlockOpcode> {
    return this.#list;
  }

  get updating(): BalancedStack<UpdatingOpcode[]> {
    return this.#updating;
  }

  get destructors(): BalancedStack<Destroyable> {
    return this.#destructors;
  }

  try() {
    this.#cache = this.#cache.begin();
    this.#scope = this.#scope.begin();
    this.#dynamicScope = this.#dynamicScope.begin();
    this.#list = this.#list.begin();
    this.#destructors = this.#destructors.begin();
  }

  catch() {
    this.#cache = this.#cache.rollback();
    this.#scope = this.#scope.rollback();
    this.#dynamicScope = this.#dynamicScope.rollback();
    this.#list = this.#list.rollback();
    this.#destructors = this.#destructors.rollback();
  }

  finally() {
    this.#cache = this.#cache.finally();
    this.#scope = this.#scope.finally();
    this.#dynamicScope = this.#dynamicScope.finally();
    this.#list = this.#list.finally();
    this.#destructors = this.#destructors.finally();
  }
}

export class VM implements PublicVM, SnapshottableVM {
  static {
    if (import.meta.env.DEV) {
      Object.defineProperties(VM.prototype, {
        debugWillCall: {
          configurable: true,
          value: function (this: VM, handle: number) {
            this.#templates?.willCall(handle);
          },
        },
        debugDidReturn: {
          enumerable: true,
          value: function (this: VM) {
            this.#templates?.return();
          },
        },
      });
    }
  }

  readonly #state: VMState;
  readonly #args: VMArgumentsImpl;
  readonly #context: JitContext;

  readonly #inner: LowLevelVM;
  readonly #templates?: TemplateDebug;

  declare debugWillCall?: (handle: number) => void;
  declare debugDidReturn?: () => void;

  constructor(
    readonly runtime: RuntimeContext,
    { pc, scope, dynamicScope, stack, unwind, context }: InitialVmState,
    private readonly elementStack: ElementBuilder
  ) {
    if (import.meta.env.DEV) {
      assertGlobalContextWasSet!();
    }

    assert(typeof pc === 'number', 'pc is a number');
    let evalStack = EvaluationStackImpl.restore(stack, pc, unwind);

    this.#context = context;
    this.elementStack = elementStack;
    this.#state = VMState.initial({ scope, dynamicScope });
    this.#args = new VMArgumentsImpl();
    this.#inner = LowLevelVM.create(
      evalStack,
      this.#heap,
      runtime.program,
      { debug: this },
      evalStack.registers
    );

    if (import.meta.env.DEV) {
      this.#templates = new TemplateDebug();
    }
  }

  get #heap() {
    return this.#context.heap;
  }

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

  get args(): VMArgumentsImpl {
    return this.#args;
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
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const vm = this;
      const templates = this.#templates!;
      const currentSlots = this.#state.scope.current.slots;
      const slots = currentSlots ? [...currentSlots] : [];
      const registers = inner.debug.registers.debug;
      const dom = this.elements();
      // const blocks = this.block

      const evalStack = inner.debug.stack;

      return {
        ...registers,
        currentPc: inner.debug.currentPc,
        constant: {
          constants: vm.constants,
          heap: vm.#heap,
        },

        dom: dom.debug,

        block: {
          metadata: templates.active,
        },

        stack: evalStack,
        scope: slots,
        updating: this.#state.updating.toArray(),
        destroyable: this.#state.destructors.toArray(),
        threw: inner.debug.threw,
      } satisfies VmDebugState;
    }

    unreachable(`BUG: Don't call 'vm.debug' without checking import.meta.env.DEV`);
  }

  public s0: unknown = null;
  public s1: unknown = null;
  public t0: unknown = null;
  public t1: unknown = null;
  public v0: unknown = null;

  earlyError(message: string, from?: SomeReactive): never {
    throw new EarlyError(message, from);
  }

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

  /**
   * Open an error recovery boundary.
   */
  pushTryFrame(catchPc: number, handler: Nullable<ErrorHandler>) {
    this.#state.try();
    this.enter(0, { unwindTarget: true });
    this.elements().pushTryFrame();
    this.#inner.beginTry(catchPc, handler);
  }

  popTryFrame(): void {
    this.#inner.popTryFrame();
    this.elements().popTryFrame();
    this.exit();
    this.#state.finally();
  }

  userException(error: unknown): TargetState {
    this.#state.catch();
    this.elements().catch();

    return this.#inner.userException(error);
  }

  // Jump to an address in `program`
  goto(offset: number) {
    this.#inner.goto(offset);
  }

  // Save $pc into $ra, then jump to a new address in `program` (jal in MIPS)
  call(handle: number | null) {
    if (handle !== null) {
      if (import.meta.env.DEV) {
        this.#templates?.willCall(handle);
      }

      this.#inner.call(handle);
    }
  }

  start(destructor = {}) {
    this.#state.destructors.push(destructor);
  }

  // Return to the `program` address stored in $ra
  return() {
    if (import.meta.env.DEV) {
      this.#templates?.return();
    }

    this.#inner.return();
  }

  static initial(runtime: RuntimeContext, context: JitContext, options: InitOptions) {
    const { handle, dynamicScope, treeBuilder, owner } = options;

    let scope =
      'self' in options
        ? PartialScopeImpl.root(options.self, options.numSymbols, owner)
        : PartialScopeImpl.root(UNDEFINED_REFERENCE, 0, owner);
    let state: InitialVmState = {
      pc: runtime.program.heap.getaddr(handle),
      scope,
      dynamicScope,
      stack: [],
      unwind: UnwindTarget.root(),
      context,
    };

    let vm = new VM(runtime, state, treeBuilder);
    vm.pushUpdating();
    vm.start();
    return vm;
  }

  static empty(
    runtime: RuntimeContext,
    { handle, treeBuilder, dynamicScope, owner }: MinimalInitOptions,
    context: JitContext
  ) {
    const vm = new VM(
      runtime,
      {
        pc: runtime.program.heap.getaddr(handle),
        scope: PartialScopeImpl.root(UNDEFINED_REFERENCE, 0, owner),
        dynamicScope,
        stack: [],
        unwind: UnwindTarget.root(),
        context,
      },
      treeBuilder
    );
    vm.pushUpdating();
    vm.start();
    return vm;
  }

  compile(block: CompilableTemplate): number {
    let handle = unwrapHandle(block.compile(this.#context));

    if (import.meta.env.DEV) {
      this.#templates?.register(handle, block.meta);
    }

    return handle;
  }

  get constants(): ProgramConstants {
    return this.program.constants;
  }

  get program(): RuntimeProgram {
    return this.runtime.program;
  }

  get env(): Environment {
    return this.runtime.env;
  }

  captureState(args: number, pc = this.#inner.pc): VmStateSnapshot {
    return {
      pc,
      scope: this.scope,
      dynamicScope: this.dynamicScope,
      stack: this.argumentsStack.capture(args),
      ...this.#inner.capture(),
      destructor: this.#destructor,
      context: this.#context,
    };
  }

  capture(args: number, pc = this.#inner.pc): ResumableVMState {
    return new ResumableVMState(this.captureState(args, pc));
  }

  beginCacheGroup(name?: string) {
    let opcodes = this.updating();
    let guard = new JumpIfNotModifiedOpcode();

    opcodes.push(guard);
    opcodes.push(new BeginTrackFrameOpcode(name));
    this.#state.cache.push(guard);

    beginTrackFrame(name);
  }

  commitCacheGroup() {
    let opcodes = this.updating();
    let guard = expect(this.#state.cache.pop(), 'VM BUG: Expected a cache group');

    let tag = endTrackFrame();
    opcodes.push(new EndTrackFrameOpcode(guard));

    guard.finalize(tag, opcodes.length);
  }

  enter(args: number, options: { unwindTarget: boolean }) {
    let updating: UpdatingOpcode[] = [];

    let state = this.capture(args);
    let block = this.elements().pushUpdatableBlock();

    let tryOpcode = new TryOpcode(state, this.runtime, block, updating, options);

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

  enterList(iterableRef: SomeReactive<OpaqueIterator>, relativeStart: number) {
    let updating: ListItemOpcode[] = [];

    let addr = this.#inner.target(relativeStart);
    let state = this.capture(0, addr);
    let list = this.elements().pushBlockList(updating) as LiveBlockList;

    let opcode = new ListBlockOpcode(state, this.runtime, list, updating, iterableRef);

    this.#state.list.push(opcode);

    this.#didEnter(opcode);
  }

  #didEnter(opcode: BlockOpcode) {
    this.associateDestroyable(opcode);
    this.#state.destructors.push(opcode);
    this.updateWith(opcode);
    this.pushUpdating(opcode.children);
  }

  exit() {
    this.#state.destructors.pop();
    this.elements().popBlock();
    this.popUpdating();
  }

  exitList() {
    this.exit();
    this.#state.list.pop();
  }

  pushUpdating(list: UpdatingOpcode[] = []): void {
    this.#state.updating.push(list);
  }

  popUpdating(): UpdatingOpcode[] {
    return expect(this.#state.updating.pop(), "can't pop an empty stack");
  }

  updateWith(opcode: UpdatingOpcode) {
    this.updating().push(opcode);
  }

  listBlock(): ListBlockOpcode {
    return expect(this.#state.list.current, 'expected a list block');
  }

  associateDestroyable(child: Destroyable): void {
    associateDestroyableChild(this.#destructor, child);
  }

  tryUpdating(): Nullable<UpdatingOpcode[]> {
    return this.#state.updating.current;
  }

  updating(): UpdatingOpcode[] {
    return this.#state.updating.present;
  }

  elements(): ElementBuilder {
    return this.elementStack;
  }

  get #destructor(): Destroyable {
    return this.#state.destructors.present;
  }

  get scope(): Scope {
    return this.#state.scope.current;
  }

  get dynamicScope(): DynamicScope {
    return this.#state.dynamicScope.current;
  }

  pushChildScope() {
    this.#state.scope.push(this.scope.child());
  }

  pushDynamicScope(): DynamicScope {
    let child = this.dynamicScope.child();
    this.#state.dynamicScope.push(child);
    return child;
  }

  pushRootScope(size: number, owner: Owner): PartialScope {
    let scope = PartialScopeImpl.sized(size, owner);
    this.#state.scope.push(scope);
    return scope;
  }

  pushScope(scope: Scope) {
    this.#state.scope.push(scope);
  }

  popScope() {
    this.#state.scope.pop();
  }

  popDynamicScope() {
    this.#state.dynamicScope.pop();
  }

  /// SCOPE HELPERS

  getOwner(): Owner {
    return this.scope.owner;
  }

  getSelf(): SomeReactive<unknown> {
    return this.scope.getSelf();
  }

  referenceForSymbol(symbol: number): SomeReactive {
    return this.scope.getSymbol(symbol);
  }

  deref<T>(reactive: SomeReactive<T>, then: (value: T) => void | Result<void>): void {
    const result = this.derefReactive(reactive);

    if (this.unwrap(result)) {
      const thenResult = then(result.value);
      if (thenResult) this.unwrap(thenResult);
    }
  }

  derefReactive<T>(reference: SomeReactive<T>): Result<T>;
  derefReactive<T, U>(reference: SomeReactive<T>, map: (value: T) => U): Result<U>;
  derefReactive(
    reference: SomeReactive<unknown>,
    map?: (value: unknown) => unknown
  ): Result<unknown> {
    return this.#deref(reference, map);
  }

  #deref(reactive: SomeReactive, map?: undefined | ((value: unknown) => unknown)): Result<unknown> {
    const result = readReactive(reactive);
    return map ? mapResult(result, map) : result;
  }

  derefN<T extends SomeReactive[]>(
    reference: T
  ): Result<{ [P in keyof T]: T[P] extends SomeReactive<infer U> ? U : T[P] }>;
  derefN<T, U>(reference: SomeReactive<T>[], map: (value: T[]) => U): Result<U[]>;
  derefN(references: SomeReactive[], map?: (value: unknown[]) => unknown): Result<unknown> {
    const results: unknown[] = [];

    for (const reference of references) {
      const result = this.#deref(reference);

      if (result.type === 'err') {
        return result;
      } else {
        results.push(result.value);
      }
    }

    return { type: 'ok', value: map ? map(results) : results };
  }

  unwrap<T>(result: Result<T>): result is OkResult<T> {
    if (result.type === 'ok') {
      return true;
    }

    const { handler } = this.userException(result.value);

    if (handler) {
      this.env.scheduleAfterRender(() => {
        handler(result.value, () => {});
      });
    }

    return false;
  }

  /// EXECUTION

  execute(initialize?: (vm: this) => void): RenderResult {
    if (import.meta.env.DEV) {
      let hasErrored = true;
      try {
        let value = this._execute(initialize);

        // using a boolean here to avoid breaking ergonomics of "pause on uncaught exceptions" which
        // would happen with a `catch` + `throw`
        hasErrored = false;

        return value;
      } finally {
        if (hasErrored) {
          // If any existing blocks are open, due to an error or something like that, we need to
          // close them all and clean things up properly.
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

    debugInit(this);

    do result = this.next();
    while (!result.done);

    if (this.#inner.result.type === 'err') {
      throw this.#inner.result.value;
    }

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

      assert(
        this.#state.destructors.size === 1,
        `Expected one destructor, got ${this.#state.destructors.size}`
      );

      result = {
        done: true,
        value: new RenderResultImpl(
          env,
          this.popUpdating(),
          elementStack.popBlock(),
          this.#destructor
        ),
      };
    }
    return result;
  }

  bindDynamicScope(names: string[]) {
    let scope = this.dynamicScope;

    for (const name of reverse(names)) {
      scope.set(name, this.stack.pop<SomeReactive<unknown>>());
    }
  }
}

export type InternalVM = VM;

// function vmState(pc: number, scope: Scope, dynamicScope: DynamicScope, unwind: UnwindTarget): VmStateSnapshot {
//   return {
//     pc,
//     scope,
//     dynamicScope,
//     stack: [],
//     unwind,
//   };
// }

export interface MinimalInitOptions {
  handle: number;
  treeBuilder: ElementBuilder;
  dynamicScope: DynamicScope;
  owner: Owner;
}

export interface ScopedInitOptions extends MinimalInitOptions {
  self: SomeReactive;
  numSymbols: number;
}

export type InitOptions = ScopedInitOptions | MinimalInitOptions;

export type VmInitCallback = (
  this: void,
  runtime: RuntimeContext,
  state: InitialVmState,
  builder: ElementBuilder
) => InternalVM;
