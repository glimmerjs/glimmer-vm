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
mod my_ref_cell;

wasm_bindgen! {
    pub fn num_allocated() -> usize {
        track::total()
    }
}

fn to_i32(a: u32) -> i32 {
    debug_assert!(a < (i32::max_value() as u32));
    a as i32
}

fn to_u32(a: i32) -> u32 {
    debug_assert!(a >= 0);
    a as u32
}
