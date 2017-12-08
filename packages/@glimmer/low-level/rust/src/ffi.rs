//! Definitions provided when this wasm module is instantiated by glimmer

extern {
    pub fn low_level_vm_debug_before(opcode: u32) -> u32;
    pub fn low_level_vm_debug_after(state: u32, opcode: u32);
    pub fn low_level_vm_evaluate_syscall(vm: u32, opcode: u32);
    pub fn low_level_vm_heap_get_addr(handle: u32, at: u32) -> i32;
    pub fn low_level_vm_heap_get_by_addr(handle: u32, at: u32) -> u32;

    #[allow(dead_code)]
    pub fn debug_println(ptr: *const u8, len: usize);
}
