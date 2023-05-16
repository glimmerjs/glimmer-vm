import type { OpcodeHeap, RuntimeOp, SomeVmOp } from '@glimmer/interfaces';
import { ARG_SHIFT, MACHINE_MASK, OPERAND_LEN_MASK, TYPE_MASK } from '@glimmer/vm';

type MACHINE_BOOL = 0 | 1;

export function sizeof(runtime: RuntimeOp): number {
  let rawType = runtime.heap.getbyaddr(runtime.offset);
  return ((rawType & OPERAND_LEN_MASK) >> ARG_SHIFT) + 1;
}

export function isMachine(op: RuntimeOp): MACHINE_BOOL {
  let rawType = op.heap.getbyaddr(op.offset);
  return rawType & MACHINE_MASK ? 1 : 0;
}

export function opType(op: RuntimeOp): SomeVmOp {
  return (op.heap.getbyaddr(op.offset) & TYPE_MASK) as SomeVmOp;
}

export class RuntimeOpImpl implements RuntimeOp {
  public offset = 0;
  constructor(readonly heap: OpcodeHeap) {}

  get op1() {
    return this.heap.getbyaddr(this.offset + 1);
  }

  get op2() {
    return this.heap.getbyaddr(this.offset + 2);
  }

  get op3() {
    return this.heap.getbyaddr(this.offset + 3);
  }
}
