// This file exports an actual instances of the Rust-compiled code to JS.
//
// This JS module is responsible for actually instantiating the Rust WebAssembly
// module and providing the exports to the rest of glimmer. Most functions are
// exported directly from the WebAssembly module but a few are wrapped in a
// relatively low-level interface here.

import { instantiate, Exports } from "./rust"; // this is the fn to instantiate the module
import { Heap, Opcode, Externs, Opcodes } from "@glimmer/program";
import { Opaque } from "@glimmer/interfaces";
import { default as wasm_bytes } from "./rust-contents";

export type VM = Opaque;

function makeOpcode(offset: number, heap: Heap): Opcode {
  let opcode = new Opcode(heap);
  opcode.offset = offset;
  return opcode;
}

// Construct the array of imports needed to instantiate the WebAssembly module.
//
// These imports are all required by `src/ffi.rs` from Rust code and are
// basically how Rust will talk back to JS during its execution.
const imports = {
  low_level_vm_debug_before(externs: Externs,
                            heap: Heap,
                            opcode: number): any {
    return externs.debugBefore(makeOpcode(opcode, heap));
  },

  low_level_vm_debug_after(externs: Externs,
                           heap: Heap,
                           state: any,
                           opcode: number): void {
    externs.debugAfter(makeOpcode(opcode, heap), state);
  },

  low_level_vm_evaluate_syscall(syscalls: Opcodes,
                                vm: VM,
                                heap: Heap,
                                opcode: number): void {
    let op = makeOpcode(opcode, heap);
    syscalls.evaluate(vm, op, op.type);
  },

  low_level_vm_heap_get_addr(heap: Heap, at: number): number {
    return heap.getaddr(at);
  },

  low_level_vm_heap_get_by_addr(heap: Heap, at: number): number {
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
