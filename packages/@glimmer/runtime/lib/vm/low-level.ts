import type { Nullable, RuntimeHeap, RuntimeOp, RuntimeProgram } from '@glimmer/interfaces';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { assert } from '@glimmer/util';
import {
  $fp,
  $ra,
  $sp,
  PUSH_FRAME_OP,
  POP_FRAME_OP,
  INVOKE_STATIC_OP,
  INVOKE_VIRTUAL_OP,
  JUMP_OP,
  RETURN_OP,
  RETURN_TO_OP,
  $pc,
} from '@glimmer/vm-constants';
import type { MachineRegister } from '@glimmer/vm-constants';

import type { VM } from './append';
import { isMachine, opType, type RuntimeOpImpl } from '@glimmer/program';
import { sizeof } from '@glimmer/program';
import { evaluate } from '../opcodes';

export interface LowLevelRegisters {
  [$pc]: number;
  [$ra]: number;
  [$sp]: number;
  [$fp]: number;
}

export function initializeRegisters(): LowLevelRegisters {
  return [0, -1, 0, 0];
}

export function initializeRegistersWithSP(sp: number): LowLevelRegisters {
  return [0, -1, sp, 0];
}

export function initializeRegistersWithPC(pc: number): LowLevelRegisters {
  return [pc, -1, 0, 0];
}

export interface Stack {
  push(value: unknown): void;
  get(position: number): number;
  pop<T>(): T;
}

export interface Externs {
  debugBefore: (opcode: RuntimeOp) => unknown;
  debugAfter: (state: unknown) => void;
}

export class LowLevelVM {
  public currentOpSize = 0;
  readonly #registers: LowLevelRegisters;

  constructor(
    public stack: Stack,
    public heap: RuntimeHeap,
    public program: RuntimeProgram,
    registers: LowLevelRegisters,
    public externs?: Externs | undefined
  ) {
    this.#registers = registers;
  }

  fetchRegister(register: MachineRegister): number {
    return this.#registers[register];
  }

  loadRegister(register: MachineRegister, value: number) {
    this.#registers[register] = value;
  }

  setPc(pc: number): void {
    assert(typeof pc === 'number' && !isNaN(pc), 'pc is set to a number');
    this.#registers[$pc] = pc;
  }

  // Start a new frame and save $ra and $fp on the stack
  pushFrame() {
    this.stack.push(this.#registers[$ra]);
    this.stack.push(this.#registers[$fp]);
    this.#registers[$fp] = this.#registers[$sp] - 1;
  }

  // Restore $ra, $sp and $fp
  popFrame() {
    this.#registers[$sp] = this.#registers[$fp] - 1;
    this.#registers[$ra] = this.stack.get(0);
    this.#registers[$fp] = this.stack.get(1);
  }

  pushSmallFrame() {
    this.stack.push(this.#registers[$ra]);
  }

  popSmallFrame() {
    this.#registers[$ra] = this.stack.pop();
  }

  // Jump to an address in `program`
  goto(offset: number) {
    this.setPc(this.target(offset));
  }

  target(offset: number) {
    return this.#registers[$pc] + offset - this.currentOpSize;
  }

  // Save $pc into $ra, then jump to a new address in `program` (jal in MIPS)
  call(handle: number) {
    assert(handle < 0xffffffff, `Jumping to placeholder address`);

    this.#registers[$ra] = this.#registers[$pc];
    this.setPc(this.heap.getaddr(handle));
  }

  // Put a specific `program` address in $ra
  returnTo(offset: number) {
    this.#registers[$ra] = this.target(offset);
  }

  // Return to the `program` address stored in $ra
  return() {
    this.setPc(this.#registers[$ra]);
  }

  nextStatement(): Nullable<RuntimeOp> {
    let { program } = this;

    let pc = this.#registers[$pc];

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
    let operationSize = (this.currentOpSize = sizeof(opcode as RuntimeOpImpl));
    this.#registers[$pc] += operationSize;

    return opcode;
  }

  evaluateOuter(opcode: RuntimeOp, vm: VM) {
    if (import.meta.env.DEV && LOCAL_DEBUG && this.externs) {
      let {
        externs: { debugBefore, debugAfter },
      } = this;
      let state = debugBefore?.(opcode);
      this.evaluateInner(opcode, vm);
      debugAfter?.(state);
      return;
    }

    this.evaluateInner(opcode, vm);
  }

  evaluateInner(opcode: RuntimeOp, vm: VM): void {
    if (isMachine(opcode)) {
      this.evaluateMachine(opcode);
    } else {
      this.evaluateSyscall(opcode, vm);
    }
  }

  evaluateMachine(opcode: RuntimeOp): void {
    switch (opType(opcode)) {
      case PUSH_FRAME_OP:
        return this.pushFrame();
      case POP_FRAME_OP:
        return this.popFrame();
      case INVOKE_STATIC_OP:
        return this.call(opcode.op1);
      case INVOKE_VIRTUAL_OP:
        return this.call(this.stack.pop());
      case JUMP_OP:
        return this.goto(opcode.op1);
      case RETURN_OP:
        return this.return();
      case RETURN_TO_OP:
        return this.returnTo(opcode.op1);
    }
  }

  evaluateSyscall(opcode: RuntimeOp, vm: VM) {
    evaluate(vm, opcode, opType(opcode));
  }
}
