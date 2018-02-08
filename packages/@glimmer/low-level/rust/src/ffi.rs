//! Definitions provided when this wasm module is instantiated by glimmer

use wasm_bindgen::prelude::*;

#[wasm_bindgen(module = "./rust-imports")]
extern {
    pub fn low_level_vm_debug_before(
        externs: &JsValue,
        opcode: u32,
    ) -> JsValue;

    pub fn low_level_vm_debug_after(
        externs: &JsValue,
        state: JsValue,
        opcode: u32,
    );

    #[wasm_bindgen(catch)]
    pub fn low_level_vm_evaluate_syscall(
        syscalls: &JsValue,
        vm: &JsValue,
        opcode: u32,
    ) -> Result<(), JsValue>;

    pub fn debug_println(msg: &str);

    pub fn low_level_vm_load_component(
        cx: &JsValue,
        obj_idx: u32,
        fields: *mut u32,
        component_idx: u32,
    );
}
