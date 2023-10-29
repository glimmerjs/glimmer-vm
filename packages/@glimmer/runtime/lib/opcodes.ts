import type { DisassembledOperand } from '@glimmer/debug';
import type { Dict, Nullable, Optional, RuntimeOp, VmMachineOp, VmOp } from '@glimmer/interfaces';
import { assert, expect, fillNulls } from '@glimmer/util';
import { OpSize } from '@glimmer/vm';

import type { VM, LowLevelVM } from './vm';
import type { InternalVM } from './vm/append';

export interface OpcodeJSON {
  type: number | string;
  guid?: Nullable<number>;
  deopted?: boolean;
  args?: string[];
  details?: Dict<Nullable<string>>;
  children?: OpcodeJSON[];
}

export type Operand1 = number;
export type Operand2 = number;
export type Operand3 = number;

export type Syscall = (vm: InternalVM, opcode: RuntimeOp) => void;
export type MachineOpcode = (vm: LowLevelVM, opcode: RuntimeOp) => void;

export type Evaluate =
  | { syscall: true; evaluate: Syscall }
  | { syscall: false; evaluate: MachineOpcode };

export type DebugState = {
  pc: number;
  sp: number;
  type: VmMachineOp | VmOp;
  isMachine: 0 | 1;
  size: number;
  params?: Optional<Dict<DisassembledOperand>>;
  name?: Optional<string>;
  state: unknown;
};

export class AppendOpcodes {
  private evaluateOpcode: Evaluate[] = fillNulls<Evaluate>(OpSize).slice();

  add<Name extends VmOp>(name: Name, evaluate: Syscall): void;
  add<Name extends VmMachineOp>(name: Name, evaluate: MachineOpcode, kind: 'machine'): void;
  add<Name extends VmOp>(name: Name, evaluate: Syscall | MachineOpcode, kind = 'syscall'): void {
    this.evaluateOpcode[name as number] = {
      syscall: kind !== 'machine',
      evaluate,
    } as Evaluate;
  }

  evaluate(vm: VM, opcode: RuntimeOp, type: number) {
    let operation = expect(this.evaluateOpcode[type], `Unknown opcode ${type}`);

    if (operation.syscall) {
      assert(
        !opcode.isMachine,
        `BUG: Mismatch between operation.syscall (${operation.syscall}) and opcode.isMachine (${opcode.isMachine}) for ${opcode.type}`
      );
      operation.evaluate(vm, opcode);
    } else {
      assert(
        opcode.isMachine,
        `BUG: Mismatch between operation.syscall (${operation.syscall}) and opcode.isMachine (${opcode.isMachine}) for ${opcode.type}`
      );
      operation.evaluate(vm.lowLevel, opcode);
    }
  }
}

export const APPEND_OPCODES = new AppendOpcodes();
