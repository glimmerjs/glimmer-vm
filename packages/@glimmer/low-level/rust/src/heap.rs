use wasm_bindgen::prelude::*;

use ffi;

pub struct Heap {
    obj: JsObject,
}

impl Heap {
    pub fn new(obj: JsObject) -> Heap {
        Heap {
            obj,
        }
    }

    pub fn get_by_addr(&self, at: u32) -> u16 {
        ffi::low_level_vm_heap_get_by_addr(&self.obj, at)
    }

    pub fn get_addr(&self, at: u32) -> i32 {
        ffi::low_level_vm_heap_get_addr(&self.obj, at)
    }
}
