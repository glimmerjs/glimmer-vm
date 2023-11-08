import type { VmMachineOp, VmSyscallOp } from '@glimmer/interfaces';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
export { Op,OpSize } from './generated/opcodes';

export type VmOp = VmMachineOp | VmSyscallOp;

export function isMachineOp(value: number): value is VmMachineOp {
  return value >= 0 && value <= 15;
}

export function isOp(value: number): value is VmOp {
  return value >= 16;
}
