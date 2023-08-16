// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import type { VmMachineOp, VmOpMap, VmSyscallOp } from './generated/vm-opcodes';

export type { VmMachineOp, VmOpMap, VmSyscallOp };
export type VmOpName = keyof VmOpMap;
export type VmOp = VmMachineOp | VmSyscallOp;
