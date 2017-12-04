// These functions are all declared in `src/lib.rs` with `#[no_mangle]` and
// similar-ish signatures.
declare const Mod: (imports: any) => {
  stack_new(): number;
  stack_free(stack: number): void;
  stack_copy(stack: number, from: number, to: number): number;
  stack_write_raw(stack: number, at: number, val: number): void;
  stack_write(stack: number, at: number, val: number): void;
  stack_read_raw(stack: number, at: number): number;
  stack_read(stack: number, at: number): number;
  stack_reset(stack: number): void;

  low_level_vm_new(heap: number, program: number): number;
  low_level_vm_free(vm: number): void;
  low_level_vm_next_statement(vm: number): number;
  low_level_vm_evaluate(vm: number, opcode: number, vm2: number): void;
  low_level_vm_stack(vm: number): number;
  low_level_vm_current_op_size(vm: number): number;
  low_level_vm_pc(vm: number): number;
  low_level_vm_set_pc(vm: number, pc: number): void;
  low_level_vm_ra(vm: number): number;
  low_level_vm_set_ra(vm: number, ra: number): void;
  low_level_vm_fp(vm: number): number;
  low_level_vm_set_fp(vm: number, fp: number): void;
  low_level_vm_sp(vm: number): number;
  low_level_vm_set_sp(vm: number, sp: number): void;
  low_level_vm_push_frame(vm: number): void;
  low_level_vm_pop_frame(vm: number): void;
  low_level_vm_goto(vm: number, offset: number): void;
  low_level_vm_call(vm: number, handle: number): void;
  low_level_vm_return_to(vm: number, offset: number): void;
  low_level_vm_return(vm: number): void;
  low_level_vm_set_stack(vm: number, stack: number): void;

  memory: WebAssembly.Memory;
};
export default Mod;
