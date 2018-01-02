// This unstable feature is currently used for the `wasm_bindgen` macro which
// allows us to define Rust code and have TypeScript automatically generated
// for consumption elsewhere.
#![feature(proc_macro)]

extern crate wasm_bindgen;

use wasm_bindgen::prelude::*;

#[macro_use]
mod debug;

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
