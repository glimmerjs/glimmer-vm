/**
 * Registers
 *
 * For the most part, these follows MIPS naming conventions, however the
 * register numbers are different.
 */

// $0 or $pc (program counter): pointer into `program` for the next insturction; -1 means exit
export const $pc = 0;
export type $pc = 0;
// $1 or $ra (return address): pointer into `program` for the return
export const $ra = 1;
export type $ra = 1;
// $2 or $fp (frame pointer): pointer into the `evalStack` for the base of the stack
export const $fp = 2;
export type $fp = 2;
// $3 or $sp (stack pointer): pointer into the `evalStack` for the top of the stack
export const $sp = 3;
export type $sp = 3;
// $4 or $up (unwind pointer): pointer into the `evalStack` for the unwind base of the stack
export const $up = 4;
export type $up = 4;

// $5-$6 or $s0-$s1 (saved): callee saved general-purpose registers
export const $s0: $s0 = 5;
export type $s0 = 5;
export const $s1: $s1 = 6;
export type $s1 = 6;
// $7-$8 or $t0-$t1 (temporaries): caller saved general-purpose registers
export const $t0: $t0 = 7;
export type $t0 = 7;
export const $t1: $t1 = 8;
export type $t1 = 8;
// $9 or $v0 (return value)
export const $v0 = 9;
export type $v0 = 9;

export type MachineRegister = typeof $pc | typeof $ra | typeof $fp | typeof $sp;

export function isLowLevelRegister(
  register: Register | MachineRegister
): register is Register & MachineRegister {
  return (register as number) <= $sp;
}

export const SavedRegister = {
  s0: $s0,
  s1: $s1,
};

export type SavedRegister = $s0 | $s1;

export const TemporaryRegister = {
  t0: $t0,
  t1: $t1,
};

export type TemporaryRegister = $t0 | $t1;

export type Register = MachineRegister | SavedRegister | TemporaryRegister | $v0;

/**
 * All of the registers except the machine registers.
 */
export type SyscallRegister = SavedRegister | TemporaryRegister | typeof $v0;
