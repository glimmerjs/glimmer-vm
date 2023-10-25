// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import type { VmMachineOp, VmSyscallOp, VmOpMap } from './generated/vm-opcodes';

export type { VmMachineOp, VmSyscallOp, VmOpMap };
export type VmOpName = keyof VmOpMap;
export type VmOp = VmMachineOp | VmSyscallOp;
