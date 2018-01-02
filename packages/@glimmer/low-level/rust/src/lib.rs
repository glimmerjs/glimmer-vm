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

extern crate wasm_bindgen;

use wasm_bindgen::prelude::*;

#[macro_use]
mod debug;

pub mod page;
pub mod stack;
pub mod vm;
pub mod opcode;
pub mod ffi;
mod track;

wasm_bindgen! {
    pub fn num_allocated() -> usize {
        track::total()
    }
}
