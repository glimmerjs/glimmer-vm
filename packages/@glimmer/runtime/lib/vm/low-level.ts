import type {
  Expand,
  Nullable,
  RuntimeHeap,
  RuntimeOp,
  RuntimeProgram,
  InternalStack,
  DebugStack,
  CleanStack,
  Result,
} from '@glimmer/interfaces';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { assert, expect } from '@glimmer/util';
import { $fp, $pc, $ra, $sp, $up, Op } from '@glimmer/vm';

import { APPEND_OPCODES } from '../opcodes';
import type { VM } from './append';
import { CheckNumber, check } from '@glimmer/debug';
import { debugAround } from './debug/debug';
import { UnwindTarget, type TargetState, type ErrorHandler } from './unwind';

export type PackedRegisters = Expand<
  [$pc: number, $ra: number, $fp: number, $sp: number, $up: UnwindTarget]
>;

export function PackedRegisters(...registers: PackedRegisters): PackedRegisters {
  assert(registers.length === 5, `Invalid registers: ${JSON.stringify(registers)}`);
  assert(
    registers.slice(0, -1).every((register) => typeof register === 'number'),
    `Invalid registers: ${JSON.stringify(registers)} ($pc, $ra, $fp, and $sp should be numbers)`
  );
  assert(
    registers.at(-1) instanceof UnwindTarget,
    `Invalid $up register: Should be a UnwindTarget`
  );

  return registers;
}

export type FrameInfo = Expand<[$ra: number, $fp: number]>;

export class Registers {
  readonly #packed: PackedRegisters;

  constructor(packed: PackedRegisters) {
    this.#packed = PackedRegisters(...packed);
  }

  get debug() {
    return {
      pc: this.#packed[$pc],
      ra: this.#packed[$ra],
      fp: this.#packed[$fp],
      sp: this.#packed[$sp],
      up: this.#packed[$up],
    };
  }

  // @premerge consolidate
  goto(pc: number): void {
    assert(typeof pc === 'number', `Invalid pc: ${typeof pc}`);
    assert(!isNaN(pc), `Invalid pc: NaN`);

    this.#packed[$pc] = pc;
  }

  // @premerge consolidate
  call(pc: number): void {
    this.#packed[$ra] = this.#packed[$pc];
    this.goto(pc);
  }

  // @premerge consolidate
  returnTo(pc: number): void {
    this.#packed[$ra] = check(pc, CheckNumber);
  }

  // @premerge consolidate
  return() {
    this.#packed[$pc] = this.#packed[$ra];
  }

  // @premerge consolidate
  advance(size: number) {
    this.#packed[$pc] += size;
    check(this.#packed[$pc], CheckNumber);
    return size;
  }

  // @premerge consolidate
  advanceSp(size: number) {
    this.#packed[$sp] += size;
    check(this.#packed[$sp], CheckNumber);
    return size;
  }

  // @premerge consolidate
  push(): number {
    return ++this.#packed[$sp];
  }

  // @premerge consolidate
  pop(n = 1): number {
    return (this.#packed[$sp] -= check(n, CheckNumber));
  }

  // @premerge consolidate
  peek(offset = 0): number {
    return this.#packed[$sp] - check(offset, CheckNumber);
  }

  // @premerge consolidate
  /**
   * Remember the previous $fp, then update $fp to point to $sp. Return the previous $fp so it can
   * be pushed onto the stack.
   *
   * This creates a linked list of $fps on the stack.
   */
  pushFp() {
    let prevFp = this.#packed[$fp];
    // the current $sp contains the $ra we already pushed, so the $fp will point to the tuple of
    // $ra and $fp
    this.#packed[$fp] = this.#packed[$sp];
    return prevFp;
  }

  // @premerge consolidate
  popTo(ra: number, fp: number): void {
    // when popping a frame, we want to restore the $sp to the position immediately before we pushed
    // the $ra and $fp onto the stack, which will effectively continue execution at that point.
    let to = this.#packed[$fp] - 1;
    this.#packed[$ra] = check(ra, CheckNumber);
    this.#packed[$fp] = check(fp, CheckNumber);
    this.#packed[$sp] = check(to, CheckNumber);
  }

  /**
   * @deprecated Direct access to .packed will be removed once all use-cases are handled via
   * semantic methods.
   */
  get packed(): PackedRegisters {
    return this.#packed;
  }

  get pc(): number {
    return this.#packed[$pc];
  }

  get ra(): number {
    return this.#packed[$ra];
  }

  get sp(): number {
    return this.#packed[$sp];
  }

  get fp(): number {
    return this.#packed[$fp];
  }

  get up(): UnwindTarget {
    return this.#packed[$up];
  }

  try(catchPc: number, handler: ErrorHandler | null) {
    this.#packed[$up] = this.#packed[$up].child({
      ip: catchPc,
      ra: this.#packed[$sp],
      fp: this.#packed[$fp],
      handler,
    });
  }

  catch(error: unknown): TargetState {
    return this.#packed[$up].catch(error);
  }

  finally() {
    this.#packed[$up] = expect(
      this.#packed[$up].finally(),
      "Since the $up starts initialized, and finally() is always paired with try(), it shouldn't be possible to pop the last $up."
    );
  }
}

export interface ArgumentsStack extends InternalStack, DebugStack {
  readonly registers: Registers;

  // @premerge consolidate (these are only used in Arguments)
  copy(from: number, to: number): void;
  set(value: unknown, offset: number, base?: number): void;
  slice<T = unknown>(start: number, end: number): T[];
  capture(items: number): unknown[];
  frame(): unknown[];
}

export interface Externs {
  debug: VM;
}

export interface VmDebugState {
  readonly registers: Registers;
  readonly currentPc: number;
  readonly stack: DebugStack;
  readonly threw: boolean;
}

let THROWN: { set: (value: boolean) => void; check: () => boolean } | undefined;

if (import.meta.env.DEV) {
  let MARKER = false;

  THROWN = {
    set: (value: boolean) => {
      MARKER = value;
    },

    check: () => MARKER,
  };
}

export class LowLevelVM {
  static create(
    stack: ArgumentsStack,
    heap: RuntimeHeap,
    program: RuntimeProgram,
    externs: Externs,
    registers: Registers
  ): LowLevelVM {
    return new LowLevelVM(stack, heap, program, externs, registers);
  }

  #currentOpSize = 0;
  readonly #registers: Registers;
  readonly #heap: RuntimeHeap;
  readonly #program: RuntimeProgram;
  readonly #stack: ArgumentsStack;

  declare threw?: () => boolean;

  private constructor(
    stack: ArgumentsStack,
    heap: RuntimeHeap,
    program: RuntimeProgram,
    readonly externs: Externs,
    registers: Registers
  ) {
    this.#stack = stack;
    this.#heap = heap;
    this.#program = program;
    this.#registers = registers;

    if (import.meta.env.DEV) {
      Object.defineProperty(this, 'threw', () => THROWN?.check());
    }
  }

  get result(): Result<void> {
    return this.#registers.up.error;
  }

  capture(): { unwind: UnwindTarget } {
    return { unwind: this.#registers.up };
  }

  // @premerge consolidate
  get stack(): CleanStack {
    return this.#stack;
  }

  // @premerge consolidate
  get internalStack(): InternalStack {
    return this.#stack;
  }

  // @premerge consolidate
  get forArguments(): ArgumentsStack {
    return this.#stack;
  }

  /**
   * @mutable
   */
  get debug(): VmDebugState {
    return {
      currentPc: this.#registers.pc - this.#currentOpSize,
      registers: this.#registers,
      stack: this.#stack,
      threw: THROWN?.check() ?? false,
    };
  }

  get pc(): number {
    return this.#registers.pc;
  }

  get sp(): number {
    return this.#registers.sp;
  }

  get fp(): number {
    return this.#registers.fp;
  }

  beginTry(catchPc: number, handler: Nullable<ErrorHandler>) {
    // resolve the catchPc to a specific instruction pointer immediately.
    this.#registers.try(this.target(catchPc), handler);
  }

  userException(error: unknown): TargetState {
    if (import.meta.env.DEV) {
      THROWN?.set(true);
    }

    const target = this.#registers.catch(error);
    this.#registers.popTo(target.ra, target.fp);
    this.#registers.goto(target.ip);

    return target;
  }

  finally() {
    this.#registers.finally();
  }

  catch(error: unknown) {
    let up = this.#registers.up;

    if (import.meta.env.DEV) {
      THROWN?.set(true);
    }

    // @fixme
    const target = up.catch(error);
    this.#registers.popTo(target.ra, target.fp);
    this.#registers.goto(target.ip);
  }

  // Start a new frame and save $ra and $fp on the stack
  pushFrame() {
    this.#stack.push(this.#registers.ra);
    this.#stack.push(this.#registers.pushFp());
  }

  // Restore $ra, $sp and $fp
  popFrame() {
    let fp = this.#registers.fp;
    // get the previous $ra and $fp from the stack (relative to the *current* $fp), and restore them
    // to the registers.
    this.#registers.popTo(this.#stack.get(0, fp), this.#stack.get(1, fp));
  }

  // Jump to an address in `program`
  goto(offset: number) {
    let pc = this.target(offset);
    assert(typeof pc === 'number', `expected pc to be a number, but it was ${typeof pc}`);
    assert(!isNaN(pc), 'expected pc to not be NaN, but it was');
    this.#registers.goto(pc);
  }

  target(offset: number) {
    return this.#registers.pc + offset - this.#currentOpSize;
  }

  // Save $pc into $ra, then jump to a new address in `program` (jal in MIPS)
  call(handle: number) {
    assert(handle < 0xffffffff, `Jumping to placeholder address`);

    this.#registers.call(this.#heap.getaddr(handle));
  }

  // Put a specific `program` address in $ra
  returnTo(offset: number) {
    this.#registers.returnTo(this.target(offset));
  }

  // Return to the `program` address stored in $ra
  return() {
    this.#registers.return();
  }

  nextStatement(): Nullable<RuntimeOp> {
    if (import.meta.env.DEV) {
      THROWN?.set(false);
    }

    let program = this.#program;
    let registers = this.#registers;

    let pc = registers.pc;

    assert(typeof pc === 'number', 'pc is a number');

    if (pc === -1) {
      return null;
    }

    // We have to save off the current operations size so that
    // when we do a jump we can calculate the correct offset
    // to where we are going. We can't simply ask for the size
    // in a jump because we have have already incremented the
    // program counter to the next instruction prior to executing.
    let opcode = program.opcode(pc);
    this.#currentOpSize = this.#registers.advance(opcode.size);

    return opcode;
  }

  evaluateOuter(opcode: RuntimeOp, vm: VM) {
    if (LOCAL_DEBUG) {
      debugAround(vm, opcode, () => this.#evaluateInner(opcode, vm));
    } else {
      this.#evaluateInner(opcode, vm);
    }
  }

  #evaluateInner(opcode: RuntimeOp, vm: VM) {
    if (opcode.isMachine) {
      this.#evaluateMachine(opcode);
    } else {
      this.#evaluateSyscall(opcode, vm);
    }
  }

  #evaluateMachine(opcode: RuntimeOp) {
    switch (opcode.type) {
      case Op.PushFrame:
        return this.pushFrame();
      case Op.PopFrame:
        return this.popFrame();
      case Op.Jump:
        return this.goto(opcode.op1);
      case Op.ReturnTo:
        return this.returnTo(opcode.op1);
      case Op.PopTryFrame:
        return this.finally();
    }
  }

  #evaluateSyscall(opcode: RuntimeOp, vm: VM) {
    APPEND_OPCODES.evaluate(vm, opcode, opcode.type);
  }
}
