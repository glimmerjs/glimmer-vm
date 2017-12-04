#![feature(link_llvm_intrinsics, allocator_api)]

mod page;
mod stack;

use stack::Stack;

#[no_mangle]
pub extern fn stack_new() -> usize {
    Stack::new().into_usize()
}

#[no_mangle]
pub unsafe extern fn stack_free(stack: usize) {
    Stack::free_usize(stack);
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
pub unsafe extern fn stack_read(stack: usize, at: u32) -> i32 {
    decode(Stack::with_stack(stack, |s| s.read(at)).unwrap_or(0))
}

fn decode(val: u64) -> i32 {
    let payload = val >> 3;
    match val & MASK {
        NUMBER => payload as i32,
        NEGATIVE => -(payload as i32),
        _ => 0, // TODO: panic?
    }
}

#[no_mangle]
pub unsafe extern fn stack_reset(stack: usize) {
    Stack::with_stack(stack, |s| s.reset())
}
