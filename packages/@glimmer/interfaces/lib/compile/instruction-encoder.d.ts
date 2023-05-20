import type { CompilerBuffer } from '../template';
import type { VmMachineOp, VmOp } from '../vm-opcodes';
import type { Operand } from './operands';

export type ARG_SHIFT = 8;
export type MAX_SIZE = 0x7f_ff_ff_ff;
export type TYPE_SIZE = 0b1111_1111;
export type TYPE_MASK = 0b0000_0000_0000_0000_0000_0000_1111_1111;
export type OPERAND_LEN_MASK = 0b0000_0000_0000_0000_0000_0011_0000_0000;
export type MACHINE_MASK = 0b0000_0000_0000_0000_0000_0100_0000_0000;

/** 0 is false, anything else is true */
export type MACHINE_BOOL = number;

export interface InstructionEncoder {
  size: number;
  readonly buffer: CompilerBuffer;

  encode(type: VmMachineOp, machine: MACHINE_MASK, ...operands: Operand[]): void;
  encode(type: VmOp, machine: 0, ...operands: Operand[]): void;

  patch(position: number, target: number): void;
}
