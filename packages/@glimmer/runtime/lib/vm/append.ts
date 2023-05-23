import { associateDestroyableChild } from '@glimmer/destroyable';
import { assertGlobalContextWasSet } from '@glimmer/global-context';
import type {
  CompilableTemplate,
  CompileTimeCompilationContext,
  Destroyable,
  DynamicScope,
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
  Stack,
  UpdatingOpcode,
  VM as PublicVM,
  Cursor,
  SimpleDOMEnvironment,
  DOMTreeBuilder,
  RuntimeBlockBoundsRef,
} from '@glimmer/interfaces';
import { LOCAL_SHOULD_LOG } from '@glimmer/local-debug-flags';
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
  Stack as StackImpl,
  unwrap,
  unwrapHandle,
} from '@glimmer/util';
import { beginTrackFrame, endTrackFrame, resetTracking } from '@glimmer/validator';
import { $fp, $pc, $s0, $s1, $sp, $t0, $t1, $v0, isLowLevelRegister } from '@glimmer/vm-constants';
import type { $ra, MachineRegister, Register, SyscallRegister } from '@glimmer/vm-constants';

import {
  BeginTrackFrameOpcode,
  EndTrackFrameOpcode,
  JumpIfNotModifiedOpcode,
} from '../compiled/opcodes/vm';
import { debugOp, type DebugState } from '../opcodes';
import { ScopeImpl } from '../scope';
import { ARGS, CONSTANTS, INNER_VM } from '../symbols';
import { VMArgumentsImpl } from './arguments';
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

export interface DebugInternalVM {
  /**
   * Verify the stack once all opcodes have been executed.
   */
  finalize: () => void;
}

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

  readonly debug?: DebugInternalVM;

  _loadValue_(register: MachineRegister, value: number): void;
  _loadValue_(register: Register, value: unknown): void;
  _loadValue_(register: Register | MachineRegister, value: unknown): void;

  _fetchValue_(register: $ra | $pc): number;
  // TODO: Something better than a type assertion?
  _fetchValue_<T>(register: Register): T;
  _fetchValue_(register: Register): unknown;

  _load_(register: Register): void;
  _fetch_(register: Register): void;

  _compile_(block: CompilableTemplate): number;

  _scope_(): Scope;
  _elements_(): DOMTreeBuilder;

  _getOwner_(): Owner;
  _getSelf_(): Reference;

  _updateWith_(opcode: UpdatingOpcode): void;

  _associateDestroyable_(d: Destroyable): void;

  _beginCacheGroup_(name?: string): void;
  _commitCacheGroup_(): void;

  /// Iteration ///

  _enterList_(iterableReference: Reference<OpaqueIterator>, offset: number): void;
  _exitList_(): void;
  _enterItem_(item: OpaqueIterationItem): ListItemOpcode;
  _registerItem_(item: ListItemOpcode): void;

  _pushRootScope_(size: number, owner: Owner): Scope;
  _pushChildScope_(): void;
  _popScope_(): void;
  _pushScope_(scope: Scope): void;

  _dynamicScope_(): DynamicScope;
  _bindDynamicScope_(names: string[]): void;
  _pushDynamicScope_(): void;
  _popDynamicScope_(): void;

  _enter_(args: number): void;
  _exit_(): void;

  _goto_(pc: number): void;
  _call_(handle: number): void;
  _pushFrame_(): void;

  _referenceForSymbol_(symbol: number): Reference;

  _execute_(initialize?: (vm: this) => void): RenderResult;
  _pushUpdating_(list?: UpdatingOpcode[]): void;
  _next_(): RichIteratorResult<null, RenderResult>;
}

class Stacks {
  readonly _scope_ = new StackImpl<Scope>();
  readonly _dynamicScope_ = new StackImpl<DynamicScope>();
  readonly _updating_ = new StackImpl<UpdatingOpcode[]>();
  readonly _cache_ = new StackImpl<JumpIfNotModifiedOpcode>();
  readonly _list_ = new StackImpl<ListBlockOpcode>();
}

export interface DebugVM {
  readonly getStacks: () => Stacks;
  readonly getCursors: () => Stack<Cursor<SimpleDOMEnvironment>>;
  readonly destroyableStack: Stack<object>;
  readonly registers: () => { s0: unknown; s1: unknown; t0: unknown; t1: unknown; v0: unknown };
}

export class VM implements PublicVM, InternalVM {
  readonly #stacks = new Stacks();
  readonly #heap: RuntimeHeap;
  readonly #destructor: object;
  readonly #destroyableStack = new StackImpl<object>();
  readonly [CONSTANTS]: RuntimeConstants & ResolutionTimeConstants;
  readonly [ARGS]: VMArgumentsImpl;
  readonly [INNER_VM]: LowLevelVM;
  readonly #elementStack: DOMTreeBuilder;

  declare readonly debug?: DebugVM & DebugInternalVM;

  get #scopeStack(): Stack<Scope> {
    return this.#stacks._scope_;
  }

  get stack(): EvaluationStack {
    return this[INNER_VM].stack as EvaluationStack;
  }

  /* Registers */

  get pc(): number {
    return this[INNER_VM].fetchRegister($pc);
  }

  #registers = Array.from({ length: $v0 - $s0 }).fill(null) as [
    s0: unknown,
    s1: unknown,
    t0: unknown,
    t1: unknown,
    v0: unknown
  ];

  // Fetch a value from a register onto the stack
  _fetch_(register: SyscallRegister): void {
    let value = this._fetchValue_(register);

    this.stack.push(value);
  }

  // Load a value from the stack into a register
  _load_(register: SyscallRegister) {
    let value = this.stack.pop();

    this._loadValue_(register, value);
  }

  // Fetch a value from a register
  _fetchValue_(register: MachineRegister): number;
  _fetchValue_<T>(register: Register): T;
  _fetchValue_(register: Register | MachineRegister): unknown {
    if (isLowLevelRegister(register)) {
      return this[INNER_VM].fetchRegister(register);
    }

    return this.#registers[register - $s0];
  }

  // Load a value into a register

  _loadValue_<T>(register: Register | MachineRegister, value: T): void {
    if (isLowLevelRegister(register)) {
      this[INNER_VM].loadRegister(register, value as any as number);
    }

    this.#registers[register - $s0] = value;
  }

  /**
   * Migrated to Inner
   */

  // Start a new frame and save $ra and $fp on the stack
  _pushFrame_() {
    this[INNER_VM].pushFrame();
  }

  // Restore $ra, $sp and $fp
  popFrame() {
    this[INNER_VM].popFrame();
  }

  // Jump to an address in `program`
  _goto_(offset: number) {
    this[INNER_VM].goto(offset);
  }

  // Save $pc into $ra, then jump to a new address in `program` (jal in MIPS)
  _call_(handle: number) {
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
    elementStack: DOMTreeBuilder,
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
          getStacks: () => this.#stacks,
          // TODO [2023-05-22]
          // @ts-expect-error TODO
          getCursors: () => unwrap(this._elements_()._debug_?.getCursors()),
          registers: () => ({
            s0: this.#registers[$s0 - $s0],
            s1: this.#registers[$s1 - $s0],
            t0: this.#registers[$t0 - $s0],
            t1: this.#registers[$t1 - $s0],
            v0: this.#registers[$v0 - $s0],
          }),
          finalize: () => {
            this.#elementStack.debug!.finalize();
          },
        } satisfies DebugVM & DebugInternalVM,
      });
    }

    this.#resume = initVM(context);
    let evalStack = EvaluationStackImpl.restore(stack);

    assert(typeof pc === 'number', 'pc is a number');

    evalStack._registers_[$pc] = pc;
    evalStack._registers_[$sp] = stack.length - 1;
    evalStack._registers_[$fp] = -1;

    this.#heap = this.program.heap;
    this[CONSTANTS] = this.program.constants;
    this.#elementStack = elementStack;
    this.#scopeStack.push(scope);
    this.#stacks._dynamicScope_.push(dynamicScope);
    this[ARGS] = new VMArgumentsImpl();
    this[INNER_VM] = new LowLevelVM(
      evalStack,
      this.#heap,
      runtime.program,
      evalStack._registers_,
      import.meta.env.DEV
        ? ((): Externs | undefined => {
            // eslint-disable-next-line prefer-let/prefer-let
            const debug = debugOp;
            return debug
              ? ({
                  debugBefore: (opcode): DebugState => debug.before(this, opcode),
                  debugAfter: (state): void => debug.after(this, state, unwrap(this.debug)),
                } as const)
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
    vm._pushUpdating_();
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
    vm._pushUpdating_();
    return vm;
  }

  readonly #resume: VmInitCallback;

  _compile_(block: CompilableTemplate): number {
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
      scope: this._scope_(),
      dynamicScope: this._dynamicScope_(),
      stack: this.stack.capture(args),
    };
  }

  capture(args: number, pc = this[INNER_VM].fetchRegister($pc)): ResumableVMState {
    return new ResumableVMStateImpl(this.captureState(args, pc), this.#resume);
  }

  _beginCacheGroup_(name?: string) {
    let opcodes = this.updating();
    let guard = new JumpIfNotModifiedOpcode();

    opcodes.push(guard, new BeginTrackFrameOpcode(name));
    this.#stacks._cache_.push(guard);

    beginTrackFrame(name);
  }

  _commitCacheGroup_() {
    let opcodes = this.updating();
    let guard = expect(this.#stacks._cache_.pop(), 'VM BUG: Expected a cache group');

    let tag = endTrackFrame();
    opcodes.push(new EndTrackFrameOpcode(guard));

    guard.finalize(tag, opcodes.length);
  }

  _enter_(args: number) {
    let updating: UpdatingOpcode[] = [];

    let state = this.capture(args);
    let block = this._elements_().startBlock();

    let tryOpcode = new TryOpcode(state, this.runtime, block as RuntimeBlockBoundsRef, updating);

    this.#didEnter(tryOpcode);
  }

  _enterItem_({ key, value, memo }: OpaqueIterationItem): ListItemOpcode {
    let { stack } = this;

    let valueReference = createIteratorItemRef(value);
    let memoReference = createIteratorItemRef(memo);

    stack.push(valueReference, memoReference);

    let state = this.capture(2);
    let block = this._elements_().startBlock();

    let opcode = new ListItemOpcode(
      state,
      this.runtime,
      block as RuntimeBlockBoundsRef,
      key,
      memoReference,
      valueReference
    );
    this.#didEnter(opcode);

    return opcode;
  }

  _registerItem_(opcode: ListItemOpcode) {
    this.listBlock().initializeChild(opcode);
  }

  _enterList_(iterableReference: Reference<OpaqueIterator>, offset: number) {
    let updating: ListItemOpcode[] = [];

    let addr = this[INNER_VM].target(offset);
    let state = this.capture(0, addr);
    let list = this._elements_().startBlock();

    let opcode = new ListBlockOpcode(
      state,
      this.runtime,
      list as RuntimeBlockBoundsRef,
      updating,
      iterableReference
    );

    this.#stacks._list_.push(opcode);

    this.#didEnter(opcode);
  }

  #didEnter(opcode: BlockOpcode) {
    this._associateDestroyable_(opcode);
    this.#destroyableStack.push(opcode);
    this._updateWith_(opcode);
    this._pushUpdating_(opcode.children);
  }

  _exit_() {
    this.#destroyableStack.pop();
    this._elements_().endBlock();
    this.popUpdating();
  }

  _exitList_() {
    this._exit_();
    this.#stacks._list_.pop();
  }

  _pushUpdating_(list: UpdatingOpcode[] = []): void {
    this.#stacks._updating_.push(list);
  }

  popUpdating(): UpdatingOpcode[] {
    return expect(this.#stacks._updating_.pop(), "can't pop an empty stack");
  }

  _updateWith_(opcode: UpdatingOpcode) {
    this.updating().push(opcode);
  }

  listBlock(): ListBlockOpcode {
    return expect(this.#stacks._list_.current, 'expected a list block');
  }

  _associateDestroyable_(child: Destroyable): void {
    let parent = expect(this.#destroyableStack.current, 'Expected destructor parent');
    associateDestroyableChild(parent, child);
  }

  tryUpdating(): Nullable<UpdatingOpcode[]> {
    return this.#stacks._updating_.current;
  }

  updating(): UpdatingOpcode[] {
    return expect(
      this.#stacks._updating_.current,
      'expected updating opcode on the updating opcode stack'
    );
  }

  _elements_(): DOMTreeBuilder {
    return this.#elementStack;
  }

  _scope_(): Scope {
    return expect(this.#scopeStack.current, 'expected scope on the scope stack');
  }

  _dynamicScope_(): DynamicScope {
    return expect(
      this.#stacks._dynamicScope_.current,
      'expected dynamic scope on the dynamic scope stack'
    );
  }

  _pushChildScope_() {
    this.#scopeStack.push(this._scope_().child());
  }

  _pushDynamicScope_(): DynamicScope {
    let child = this._dynamicScope_().child();
    this.#stacks._dynamicScope_.push(child);
    return child;
  }

  _pushRootScope_(size: number, owner: Owner): Scope {
    let scope = ScopeImpl.sized(size, owner);
    this.#scopeStack.push(scope);
    return scope;
  }

  _pushScope_(scope: Scope) {
    this.#scopeStack.push(scope);
  }

  _popScope_() {
    this.#scopeStack.pop();
  }

  _popDynamicScope_() {
    this.#stacks._dynamicScope_.pop();
  }

  /// SCOPE HELPERS

  _getOwner_(): Owner {
    return this._scope_().owner;
  }

  _getSelf_(): Reference<any> {
    return this._scope_().getSelf();
  }

  _referenceForSymbol_(symbol: number): Reference {
    return this._scope_().getSymbol(symbol);
  }

  /// EXECUTION

  _execute_(initialize?: (vm: this) => void): RenderResult {
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
          let elements = this._elements_();
          elements.recover();

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

    do result = this._next_();
    while (!result.done);

    return result.value;
  }

  _next_(): RichIteratorResult<null, RenderResult> {
    let { env } = this;
    let opcode = this[INNER_VM].nextStatement();
    let result: RichIteratorResult<null, RenderResult>;
    if (opcode === null) {
      // Unload the stack
      this.stack.reset();

      result = {
        done: true,
        value: new RenderResultImpl(
          env,
          this.popUpdating(),
          this.#elementStack.return(),
          this.#destructor
        ),
      };
    } else {
      this[INNER_VM].evaluateOuter(opcode, this);
      result = { done: false, value: null };
    }
    return result;
  }

  _bindDynamicScope_(names: string[]) {
    let scope = this._dynamicScope_();

    for (let name of reverse(names)) {
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
  treeBuilder: DOMTreeBuilder;
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
  builder: DOMTreeBuilder
) => InternalVM;

function initVM(context: CompileTimeCompilationContext): VmInitCallback {
  return (runtime, state, builder) => new VM(runtime, state, builder, context);
}
