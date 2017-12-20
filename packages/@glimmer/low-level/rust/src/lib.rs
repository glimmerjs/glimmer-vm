// This unstable feature is required for the `page` module which accesses the
// raw wasm memory allocation instructions for now. Eventually we may move
// to libstd allocations but for now it's intended to be an allocator with a
// smaller code-size footprint as in theory it's not necessary for this
// appplication to need a full-blown allocator.
#![feature(link_llvm_intrinsics)]

// This unstable feature is currently used for the `wasm_bindgen` macro which
// allows us to define Rust code and have TypeScript automatically generated
// for consumption elsewhere.
#![feature(proc_macro)]

// We're optimizing for code size, so don't accidentally use any libstd
// abstractions
#![no_std]
extern crate std as _std; // ensure we link correctly though by still using libstd

extern crate wasm_bindgen;

use wasm_bindgen::prelude::*;

// an unfortunate hack for now to get wasm_bindgen working which expects
// `std`-relative paths
mod std {
    pub use core::slice;
    pub use core::str;
    pub use core::mem;
}

#[macro_use]
mod debug;

pub mod page;
pub mod stack;
pub mod vm;
pub mod opcode;
pub mod ffi;
pub mod boxed;

use stack::Stack;
use vm::LowLevelVM;

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

    // TODO: this is pretty sketchy, should maybe used an `Rc` or something like
    // that here?
    pub fn low_level_vm_stack(vm: &LowLevelVM) -> usize {
        vm.stack_inner_usize()
    }

    pub fn page_num_allocated() -> u32 {
        page::num_allocated()
    }
}
