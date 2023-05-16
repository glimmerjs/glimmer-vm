/**
 * Registers
 *
 * For the most part, these follows MIPS naming conventions, however the
 * register numbers are different.
 */

export type MachineRegister = $pc | $ra | $fp | $sp;

// $0 or $pc (program counter): pointer into `program` for the next insturction; -1 means exit
export const $pc = 0;
export type $pc = typeof $pc;
// $1 or $ra (return address): pointer into `program` for the return
export const $ra = 1;
export type $ra = typeof $ra;
// $2 or $fp (frame pointer): pointer into the `evalStack` for the base of the stack
export const $fp = 2;
export type $fp = typeof $fp;
// $3 or $sp (stack pointer): pointer into the `evalStack` for the top of the stack
export const $sp = 3;
export type $sp = typeof $sp;

// $4-$5 or $s0-$s1 (saved): callee saved general-purpose registers
export const $s0 = 4;
export type $s0 = typeof $s0;
export const $s1 = 5;
export type $s1 = typeof $s1;
export type SavedRegister = $s0 | $s1;

// $6-$7 or $t0-$t1 (temporaries): caller saved general-purpose registers
export const $t0 = 6;
export type $t0 = typeof $t0;
export const $t1 = 7;
export type $t1 = typeof $t1;
export type TemporaryRegister = $t0 | $t1;
// $8 or $v0 (return value)
export const $v0 = 8;

export function isLowLevelRegister(
  register: Register | MachineRegister
): register is Register & MachineRegister {
  return (register as number) <= $sp;
}

export type Register = MachineRegister | SavedRegister | TemporaryRegister | typeof $v0;
export type SyscallRegister = SavedRegister | TemporaryRegister | typeof $v0;
