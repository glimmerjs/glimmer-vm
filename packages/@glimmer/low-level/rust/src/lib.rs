#![feature(link_llvm_intrinsics, proc_macro)]

// We're optimizing for code size, so don't accidentally use any libstd
// abstractions
#![no_std]
extern crate std as _std; // ensure we link correctly though by still using libstd

extern crate wasm_bindgen;

use wasm_bindgen::prelude::*;

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
use vm::{Heap, LowLevelVM};

macro_rules! bail_if_zero {
    ($e:expr) => (if $e as usize == 0 {
        debug_assert!(false, "argument is 0 or null");
        debug::abort()
    })
}

wasm_bindgen! {
    pub fn stack_copy(stack: usize, from: u32, to: u32) -> u32 {
        bail_if_zero!(stack);
        unsafe {
            Stack::with_stack(stack, |s| s.copy(from, to)).is_ok() as u32
        }
    }

    pub fn stack_write_raw(stack: usize, at: u32, val: u32) {
        bail_if_zero!(stack);
        unsafe {
            Stack::with_stack(stack, |s| s.write_raw(at, val))
        }
    }

    pub fn stack_write(stack: usize, at: u32, val: i32) {
        bail_if_zero!(stack);
        unsafe {
            Stack::with_stack(stack, |s| s.write(at, val))
        }
    }

    pub fn stack_read_raw(stack: usize, at: u32) -> u32 {
        bail_if_zero!(stack);
        unsafe {
            Stack::with_stack(stack, |s| s.read_raw(at)).unwrap_or(0)
        }
    }

    pub fn stack_read(stack: usize, at: u32) -> i32 {
        bail_if_zero!(stack);
        unsafe {
            Stack::with_stack(stack, |s| s.read(at)).unwrap_or(0)
        }
    }

    pub fn stack_reset(stack: usize) {
        bail_if_zero!(stack);
        unsafe {
            Stack::with_stack(stack, |s| s.reset())
        }
    }

    pub fn low_level_vm_new(heap: u32, devmode: u32) -> *mut LowLevelVM {
        let stack = Stack::new();
        let stack = vm::Stack::new(0, -1, stack);
        let heap = Heap::new(heap);
        let vm = BigBox::new(LowLevelVM::new(heap, stack, devmode != 0));
        BigBox::into_raw(vm)
    }

    pub fn low_level_vm_free(vm: *mut LowLevelVM) {
        bail_if_zero!(vm);
        unsafe {
            BigBox::from_raw(vm as *mut LowLevelVM);
        }
    }

    // TODO: should these functions deal with `&mut LowLevelVM` instead of `*mut`?
    pub fn low_level_vm_next_statement(vm: *mut LowLevelVM) -> u32 {
        bail_if_zero!(vm);
        unsafe {
            match (*vm).next_statement() {
                Some(opcode) => opcode.offset(),
                None => u32::max_value(),
            }
        }
    }

    pub fn low_level_vm_evaluate(vm: *mut LowLevelVM, opcode: u32, vm2: u32) {
        bail_if_zero!(vm);
        unsafe {
            (*vm).evaluate_outer(Opcode::new(opcode), vm2)
        }
    }

    pub fn low_level_vm_current_op_size(vm: *mut LowLevelVM) -> u32 {
        bail_if_zero!(vm);
        unsafe {
            (*vm).current_op_size()
        }
    }

    pub fn low_level_vm_pc(vm: *mut LowLevelVM) -> i32 {
        bail_if_zero!(vm);
        unsafe {
            (*vm).pc()
        }
    }

    pub fn low_level_vm_set_pc(vm: *mut LowLevelVM, pc: i32) {
        bail_if_zero!(vm);
        unsafe {
            (*vm).set_pc(pc)
        }
    }

    pub fn low_level_vm_ra(vm: *mut LowLevelVM) -> i32 {
        bail_if_zero!(vm);
        unsafe {
            (*vm).ra()
        }
    }

    pub fn low_level_vm_set_ra(vm: *mut LowLevelVM, ra: i32) {
        bail_if_zero!(vm);
        unsafe {
            (*vm).set_ra(ra)
        }
    }

    pub fn low_level_vm_fp(vm: *mut LowLevelVM) -> i32 {
        bail_if_zero!(vm);
        unsafe {
            (*vm).fp()
        }
    }

    pub fn low_level_vm_set_fp(vm: *mut LowLevelVM, fp: i32) {
        bail_if_zero!(vm);
        unsafe {
            (*vm).set_fp(fp)
        }
    }

    pub fn low_level_vm_sp(vm: *mut LowLevelVM) -> i32 {
        bail_if_zero!(vm);
        unsafe {
            (*vm).sp()
        }
    }

    pub fn low_level_vm_set_sp(vm: *mut LowLevelVM, sp: i32) {
        bail_if_zero!(vm);
        unsafe {
            (*vm).set_sp(sp)
        }
    }

    pub fn low_level_vm_push_frame(vm: *mut LowLevelVM) {
        bail_if_zero!(vm);
        unsafe {
            (*vm).push_frame();
        }
    }

    pub fn low_level_vm_pop_frame(vm: *mut LowLevelVM) {
        bail_if_zero!(vm);
        unsafe {
            (*vm).pop_frame();
        }
    }

    pub fn low_level_vm_goto(vm: *mut LowLevelVM, offset: i32) {
        bail_if_zero!(vm);
        unsafe {
            (*vm).goto(offset);
        }
    }

    pub fn low_level_vm_call(vm: *mut LowLevelVM, handle: u32) {
        bail_if_zero!(vm);
        unsafe {
            (*vm).call(handle)
        }
    }

    pub fn low_level_vm_return_to(vm: *mut LowLevelVM, offset: i32) {
        bail_if_zero!(vm);
        unsafe {
            (*vm).return_to(offset)
        }
    }

    pub fn low_level_vm_return(vm: *mut LowLevelVM) {
        bail_if_zero!(vm);
        unsafe {
            (*vm).return_()
        }
    }

    // TODO: this is pretty sketchy, should maybe used an `Rc` or something like
    // that here?
    pub fn low_level_vm_stack(vm: *mut LowLevelVM) -> usize {
        bail_if_zero!(vm);
        unsafe {
            (*vm).stack().as_inner_usize()
        }
    }

    pub fn page_num_allocated() -> u32 {
        page::num_allocated()
    }
}
