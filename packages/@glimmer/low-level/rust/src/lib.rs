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

wasm_bindgen! {
    pub fn page_num_allocated() -> u32 {
        page::num_allocated()
    }
}
