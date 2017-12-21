// This file exports an actual instances of the Rust-compiled code to JS.
//
// This JS module is responsible for actually instantiating the Rust WebAssembly
// module and providing the exports to the rest of glimmer. Most functions are
// exported directly from the WebAssembly module but a few are wrapped in a
// relatively low-level interface here.

import { instantiate, Exports } from "./rust"; // this is the fn to instantiate the module
import { default as wasm_bytes } from "./rust-contents";

// Construct the array of imports needed to instantiate the WebAssembly module.
//
// These imports are all required by `src/ffi.rs` from Rust code and are
// basically how Rust will talk back to JS during its execution.
const imports = {
  low_level_vm_debug_before(externs: any, offset: number): any {
    return externs.debugBefore(offset);
  },

  low_level_vm_debug_after(externs: any,
                           state: any,
                           offset: number): void {
    externs.debugAfter(offset, state);
  },

  low_level_vm_evaluate_syscall(syscalls: any, vm: any, offset: number): void {
    syscalls.evaluate(vm, offset);
  },

  low_level_vm_heap_get_addr(heap: any, at: number): number {
    return heap.getaddr(at);
  },

  low_level_vm_heap_get_by_addr(heap: any, at: number): number {
    return heap.getbyaddr(at);
  },

  debug_println: console.log,
};

// TODO: the way that `wasm` is exposed here is a bit of a hack. It's actually
//       filled in asynchronously but we don't want it itself to be a promise as
//       that'll cause too much else to be required to be a promise. For now
//       just fill it in a with a dummy null and hope that it's not used until
//       after `booted` below is resolved.
export let wasm: { exports: Exports } = {} as { exports:Exports };

export const booted: Promise<boolean> = wasm_bytes
  .then(bytes => instantiate(bytes, imports))
  .then(exports => {
    wasm.exports = exports;
    return true;
  });
