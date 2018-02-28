import { memory } from "./rust_wasm";

// Construct the array of imports needed to instantiate the WebAssembly module.
//
// These imports are all required by `src/ffi.rs` from Rust code and are
// basically how Rust will talk back to JS during its execution.
export function low_level_vm_debug_before(externs: any, offset: number): any {
  return externs.debugBefore(offset);
}

export function low_level_vm_debug_after(externs: any,
                         state: any,
                         offset: number): void {
  externs.debugAfter(offset, state);
}

export function low_level_vm_evaluate_syscall(syscalls: any, vm: any, offset: number): void {
  syscalls.evaluate(vm, offset);
}

export function low_level_vm_load_component(cx: any, gbox: number, ptr: number, component: number): void {
  const buf = new Uint32Array(memory.buffer);
  return cx.loadComponent(gbox, buf, ptr / 4, component);
}

export const debug_println = console.log;
