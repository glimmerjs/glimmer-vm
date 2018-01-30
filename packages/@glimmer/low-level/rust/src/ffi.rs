//! Definitions provided when this wasm module is instantiated by glimmer

use wasm_bindgen::prelude::*;

wasm_bindgen! {
    #[wasm_module = "./rust-imports"]
    extern "JS" {
        pub fn low_level_vm_debug_before(
            externs: &JsObject,
            opcode: u32,
        ) -> JsObject;

        pub fn low_level_vm_debug_after(
            externs: &JsObject,
            state: JsObject,
            opcode: u32,
        );

        pub fn low_level_vm_evaluate_syscall(
            syscalls: &JsObject,
            vm: &JsObject,
            opcode: u32,
        );

        pub fn debug_println(msg: &str);

        pub fn low_level_vm_load_component(
            cx: &JsObject,
            obj_idx: u32,
            fields: *mut u32,
            component_idx: u32,
        );
    }
}
