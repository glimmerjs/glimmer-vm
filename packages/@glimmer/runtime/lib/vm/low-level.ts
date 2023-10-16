import type { Nullable, RuntimeHeap, RuntimeOp, RuntimeProgram } from '@glimmer/interfaces';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { assert } from '@glimmer/util';
import { $fp, $pc, $ra, $sp, MachineOp, type MachineRegister } from '@glimmer/vm';

import { APPEND_OPCODES } from '../opcodes';
import type { VM } from './append';

export interface PackedRegisters {
  [$pc]: number;
  [$ra]: number;
  [$sp]: number;
  [$fp]: number;
}

export class Registers {
  readonly #packed: PackedRegisters;

  constructor(packed: PackedRegisters) {
    this.#packed = packed;
  }

  // @premerge consolidate
  goto(pc: number): void {
    this.#packed[$pc] = pc;
  }

  // @premerge consolidate
  call(pc: number): void {
    this.#packed[$ra] = this.#packed[$pc];
    this.goto(pc);
  }

  // @premerge consolidate
  returnTo(pc: number): void {
    this.#packed[$ra] = pc;
  }

  // @premerge consolidate
  return() {
    this.#packed[$pc] = this.#packed[$ra];
  }

  // @premerge consolidate
  advance(size: number) {
    this.#packed[$pc] += size;
    return size;
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
}

export function initializeRegisters(): PackedRegisters {
  return [0, -1, 0, 0];
}

export function initializeRegistersWithSP(sp: number): PackedRegisters {
  return [0, -1, sp, 0];
}

export function initializeRegistersWithPC(pc: number): PackedRegisters {
  return [pc, -1, 0, 0];
}

export interface Stack {
  readonly registers: Registers;
  push(value: unknown): void;
  get<T = number>(position: number, base?: number): T;
  pop<T>(count?: number): T;
}

export interface Externs {
  debugBefore(opcode: RuntimeOp): unknown;
  debugAfter(state: unknown): void;
}

export interface VmDebugState {
  registers: Registers;
}

export class LowLevelVM {
  static create(
    stack: Stack,
    heap: RuntimeHeap,
    program: RuntimeProgram,
    externs: Externs,
    registers: PackedRegisters
  ): LowLevelVM {
    return new LowLevelVM(stack, heap, program, externs, new Registers(registers));
  }

  #currentOpSize = 0;
  readonly #registers: Registers;
  readonly #heap: RuntimeHeap;
  readonly #program: RuntimeProgram;

  private constructor(
    readonly stack: Stack,
    heap: RuntimeHeap,
    program: RuntimeProgram,
    readonly externs: Externs,
    registers: Registers
  ) {
    this.#heap = heap;
    this.#program = program;
    this.#registers = registers;
  }

  get debug(): VmDebugState {
    return {
      registers: this.#registers,
    };
  }

  fetchRegister(register: MachineRegister): number {
    return this.#registers.packed[register];
  }

  loadRegister(register: MachineRegister, value: number) {
    this.#registers.packed[register] = value;
  }

  setPc(pc: number): void {
    assert(typeof pc === 'number' && !isNaN(pc), 'pc is set to a number');
    this.#registers.goto(pc);
  }

  // Start a new frame and save $ra and $fp on the stack
  pushFrame() {
    this.stack.push(this.#registers.ra);
    this.stack.push(this.#registers.fp);
    this.#registers.packed[$fp] = this.#registers.packed[$sp] - 1;
  }

  // Restore $ra, $sp and $fp
  popFrame() {
    this.#registers.packed[$sp] = this.#registers.packed[$fp] - 1;
    this.#registers.packed[$ra] = this.stack.get(0);
    this.#registers.packed[$fp] = this.stack.get(1);
  }

  pushSmallFrame() {
    this.stack.push(this.#registers.ra);
  }

  popSmallFrame() {
    this.#registers.packed[$ra] = this.stack.pop();
  }

  // Jump to an address in `program`
  goto(offset: number) {
    this.setPc(this.target(offset));
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
      let {
        externs: { debugBefore, debugAfter },
      } = this;
      let state = debugBefore(opcode);
      this.evaluateInner(opcode, vm);
      debugAfter(state);
    } else {
      this.evaluateInner(opcode, vm);
    }
  }

  evaluateInner(opcode: RuntimeOp, vm: VM) {
    if (opcode.isMachine) {
      this.evaluateMachine(opcode);
    } else {
      this.evaluateSyscall(opcode, vm);
    }
  }

  evaluateMachine(opcode: RuntimeOp) {
    switch (opcode.type) {
      case MachineOp.PushFrame:
        return this.pushFrame();
      case MachineOp.PopFrame:
        return this.popFrame();
      case MachineOp.InvokeStatic:
        return this.call(opcode.op1);
      case MachineOp.InvokeVirtual:
        return this.call(this.stack.pop());
      case MachineOp.Jump:
        return this.goto(opcode.op1);
      case MachineOp.Return:
        return this.return();
      case MachineOp.ReturnTo:
        return this.returnTo(opcode.op1);
    }
  }

  evaluateSyscall(opcode: RuntimeOp, vm: VM) {
    APPEND_OPCODES.evaluate(vm, opcode, opcode.type);
  }
}
