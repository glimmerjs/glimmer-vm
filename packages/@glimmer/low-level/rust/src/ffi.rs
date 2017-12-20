//! Definitions provided when this wasm module is instantiated by glimmer

use wasm_bindgen::prelude::*;

wasm_bindgen! {
    extern "JS" {
        pub fn low_level_vm_debug_before(
            externs: &JsObject,
            heap: &JsObject,
            opcode: u32,
        ) -> JsObject;

        pub fn low_level_vm_debug_after(
            externs: &JsObject,
            heap: &JsObject,
            state: JsObject,
            opcode: u32,
        );

        pub fn low_level_vm_evaluate_syscall(
            syscalls: &JsObject,
            vm: &JsObject,
            heap: &JsObject,
            opcode: u32,
        );

        pub fn low_level_vm_heap_get_addr(heap: &JsObject, at: u32) -> i32;
        pub fn low_level_vm_heap_get_by_addr(heap: &JsObject, at: u32) -> u32;
        pub fn debug_println(msg: &str);
    }
}
