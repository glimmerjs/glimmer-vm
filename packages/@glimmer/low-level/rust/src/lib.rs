#![feature(link_llvm_intrinsics, allocator_api)]

#[macro_use]
mod debug;

mod page;
mod stack;
mod vm;
mod opcode;
mod ffi;
mod boxed;

use boxed::BigBox;
use opcode::Opcode;
use stack::Stack;
use vm::{Heap, Program, LowLevelVM};

#[no_mangle]
pub extern fn stack_new() -> usize {
    Stack::new().into_usize()
}

#[no_mangle]
pub unsafe extern fn stack_free(stack: usize) {
    drop(Stack::from_usize(stack));
}

#[no_mangle]
pub unsafe extern fn stack_copy(stack: usize, from: u32, to: u32) -> u32 {
    Stack::with_stack(stack, |s| s.copy(from, to)).is_ok() as u32
}

#[no_mangle]
pub unsafe extern fn stack_write_raw(stack: usize, at: u32, val: u32) {
    Stack::with_stack(stack, |s| s.write_raw(at, val))
}

#[no_mangle]
pub unsafe extern fn stack_write(stack: usize, at: u32, val: i32) {
    Stack::with_stack(stack, |s| s.write(at, val))
}

#[no_mangle]
pub unsafe extern fn stack_read_raw(stack: usize, at: u32) -> u32 {
    Stack::with_stack(stack, |s| s.read_raw(at)).unwrap_or(0)
}

#[no_mangle]
pub unsafe extern fn stack_read(stack: usize, at: u32) -> i32 {
    Stack::with_stack(stack, |s| s.read(at)).unwrap_or(0)
}

#[no_mangle]
pub unsafe extern fn stack_reset(stack: usize) {
    Stack::with_stack(stack, |s| s.reset())
}

#[no_mangle]
pub unsafe extern fn low_level_vm_new(heap: u32, program: u32) -> *mut LowLevelVM {
    let stack = Stack::new();
    let stack = vm::Stack::new(0, -1, stack);
    let heap = Heap::new(heap);
    let program = Program::new(program);
    let vm = BigBox::new(LowLevelVM::new(heap, program, stack));
    BigBox::into_raw(vm)
}

#[no_mangle]
pub unsafe extern fn low_level_vm_free(vm: *mut LowLevelVM) {
    BigBox::from_raw(vm as *mut LowLevelVM);
}

#[no_mangle]
pub unsafe extern fn low_level_vm_next_statement(vm: *mut LowLevelVM) -> u32 {
    match (*vm).next_statement() {
        Some(opcode) => opcode.offset(),
        None => u32::max_value(),
    }
}

#[no_mangle]
pub unsafe extern fn low_level_vm_evaluate(vm: *mut LowLevelVM, opcode: u32, vm2: u32) {
    (*vm).evaluate_outer(Opcode::new(opcode), vm2)
}

#[no_mangle]
pub unsafe extern fn low_level_vm_current_op_size(vm: *mut LowLevelVM) -> u32 {
    (*vm).current_op_size()
}

#[no_mangle]
pub unsafe extern fn low_level_vm_pc(vm: *mut LowLevelVM) -> i32 {
    (*vm).pc()
}

#[no_mangle]
pub unsafe extern fn low_level_vm_set_pc(vm: *mut LowLevelVM, pc: i32) {
    let vm = &mut *vm;
    vm.set_pc(pc)
}

#[no_mangle]
pub unsafe extern fn low_level_vm_ra(vm: *mut LowLevelVM) -> i32 {
    (*vm).ra()
}

#[no_mangle]
pub unsafe extern fn low_level_vm_set_ra(vm: *mut LowLevelVM, ra: i32) {
    (*vm).set_ra(ra)
}

#[no_mangle]
pub unsafe extern fn low_level_vm_fp(vm: *mut LowLevelVM) -> i32 {
    (*vm).fp()
}

#[no_mangle]
pub unsafe extern fn low_level_vm_set_fp(vm: *mut LowLevelVM, fp: i32) {
    (*vm).set_fp(fp)
}

#[no_mangle]
pub unsafe extern fn low_level_vm_sp(vm: *mut LowLevelVM) -> i32 {
    (*vm).sp()
}

#[no_mangle]
pub unsafe extern fn low_level_vm_set_sp(vm: *mut LowLevelVM, sp: i32) {
    (*vm).set_sp(sp)
}

#[no_mangle]
pub unsafe extern fn low_level_vm_push_frame(vm: *mut LowLevelVM) {
    (*vm).push_frame();
}

#[no_mangle]
pub unsafe extern fn low_level_vm_pop_frame(vm: *mut LowLevelVM) {
    (*vm).pop_frame();
}

#[no_mangle]
pub unsafe extern fn low_level_vm_goto(vm: *mut LowLevelVM, offset: i32) {
    (*vm).goto(offset);
}

#[no_mangle]
pub unsafe extern fn low_level_vm_call(vm: *mut LowLevelVM, handle: u32) {
    (*vm).call(handle)
}

#[no_mangle]
pub unsafe extern fn low_level_vm_return_to(vm: *mut LowLevelVM, offset: i32) {
    (*vm).return_to(offset)
}

#[no_mangle]
pub unsafe extern fn low_level_vm_return(vm: *mut LowLevelVM) {
    (*vm).return_()
}

// TODO: this is pretty sketchy, should maybe used an `Rc` or something like
// that here?
#[no_mangle]
pub unsafe extern fn low_level_vm_stack(vm: *mut LowLevelVM) -> usize {
    (*vm).stack().as_inner_usize()
}
