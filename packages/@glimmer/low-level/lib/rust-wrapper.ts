// This file exports an actual instances of the Rust-compiled code to JS.
//
// This JS module is responsible for actually instantiating the Rust WebAssembly
// module and providing the exports to the rest of glimmer. Most functions are
// exported directly from the WebAssembly module but a few are wrapped in a
// relatively low-level interface here.

import { default as instantiate, Exports } from "./rust"; // this is the fn to instantiate the module
import { Heap, Opcode } from "@glimmer/program";
import { WasmExterns, WasmVM, WASM_APPEND_OPCODES } from "@glimmer/runtime";
import { Option, Opaque } from "@glimmer/interfaces";
import { assert } from "@glimmer/util";

let EXTERNS: Option<WasmExterns> = null;
let HEAP: Option<Heap> = null;
let VM: Option<WasmVM<Opaque>> = null;

function set_vm(vm: WasmVM<Opaque>) {
  assert(VM === null, 'vm is already set');
  VM = vm;
}

function set_externs(externs: WasmExterns) {
  assert(EXTERNS === null, 'externs is already set');
  EXTERNS = externs;
}

function set_heap(heap: Heap) {
  assert(HEAP === null, 'heap is already set');
  HEAP = heap;
}

let DEBUG_STATE: any = null;

function makeOpcode(offset: number): Opcode {
  if (HEAP === null)
    throw new Error("heap should have been set already");
  let opcode = new Opcode(HEAP);
  opcode.offset = offset;
  return opcode;
}

// Construct the array of imports needed to instantiate the WebAssembly module.
//
// These imports are all required by `src/ffi.rs` from Rust code and are
// basically how Rust will talk back to JS during its execution.
const imports = {
  env: {
    low_level_vm_debug_before(opcode: number): number {
      if (EXTERNS === null)
        return 0;
      assert(DEBUG_STATE === null, "recursively called?");
      DEBUG_STATE = EXTERNS.debugBefore(makeOpcode(opcode));
      return 1;
    },

    low_level_vm_debug_after(state: number, opcode: number): void {
      if (state !== 1 || EXTERNS === null)
        return;
      assert(DEBUG_STATE !== null, "recursively called?");
      let debug_state = DEBUG_STATE;
      DEBUG_STATE = null;
      EXTERNS.debugAfter(makeOpcode(opcode), debug_state);
    },

    low_level_vm_evaluate_syscall(_vm: number, opcode: number): void {
      if (VM === null)
        throw new Error("vm should have been set already");
      let op = makeOpcode(opcode);
      WASM_APPEND_OPCODES.evaluate(VM, op, op.type);
    },

    low_level_vm_heap_get_addr(_handle: number, at: number): number {
      if (HEAP === null)
        throw new Error("heap should have been set already");
      return HEAP.getaddr(at);
    },

    low_level_vm_heap_get_by_addr(_handle: number, at: number): number {
      if (HEAP === null)
        throw new Error("heap should have been set already");
      return HEAP.getbyaddr(at);
    },

    // currently only used when debugging
    debug_println(ptr: number, len: number): void {
      let mem = new Uint8Array(wasm.memory.buffer);
      let slice = mem.slice(ptr, ptr + len);
      let s = new TextDecoder("utf-8").decode(slice);
      console.log(s);
    },
  },
};

export const wasm: Exports = instantiate(imports);

// Wrap a few functions to set our globals in this module above so while Rust is
// executing we have access to the various JS objects passed in.

export function low_level_vm_next_statement(vm: number, heap: Heap) {
  // TODO: there should be a better way of handling these JS objects going
  // across these functions. The `heap` and `program` passed in here are
  // transferred across this function call via the globals above and are again
  // used when wasm calls back into JS.
  //
  // Eventually though there may be multiple disconnected applications using the
  // same glimmer library so this may not cut it.
  try {
    set_heap(heap);
    let opcode = wasm.low_level_vm_next_statement(vm);
    if (opcode === -1) {
      return null;
    } else {
      let op = new Opcode(heap);
      op.offset = opcode;
      return op;
    }
  } finally {
    HEAP = null;
    DEBUG_STATE = null;
  }
}

export function low_level_vm_evaluate(vm: number,
                                      vm2: WasmVM<Opaque>,
                                      externs: WasmExterns,
                                      heap: Heap,
                                      opcode: Opcode) {
  try {
    set_vm(vm2);
    set_externs(externs);
    set_heap(heap);
    wasm.low_level_vm_evaluate(vm, opcode.offset, 0);
  } finally {
    VM = null;
    EXTERNS = null;
    HEAP = null;
    DEBUG_STATE = null;
  }
}
