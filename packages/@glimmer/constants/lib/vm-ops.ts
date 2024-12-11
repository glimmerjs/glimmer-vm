import type {
  VmMachineInvokeStatic,
  VmMachineInvokeVirtual,
  VmMachineJump,
  VmMachineOp,
  VmMachinePopFrame,
  VmMachinePushFrame,
  VmMachineReturn,
  VmMachineReturnTo,
  VmMachineSize,
} from '@glimmer/interfaces';

export const VM_PUSH_FRAME_OP: VmMachinePushFrame = 0;
export const VM_POP_FRAME_OP: VmMachinePopFrame = 1;
export const VM_INVOKE_VIRTUAL_OP: VmMachineInvokeVirtual = 2;
export const VM_INVOKE_STATIC_OP: VmMachineInvokeStatic = 3;
export const VM_JUMP_OP: VmMachineJump = 4;
export const VM_RETURN_OP: VmMachineReturn = 5;
export const VM_RETURN_TO_OP: VmMachineReturnTo = 6;
export const VM_MACHINE_SIZE: VmMachineSize = 7;

export function isMachineOp(value: number): value is VmMachineOp {
  return value >= 0 && value <= 15;
}
