// This file exports an actual instances of the Rust-compiled code to JS.
//
// This JS module is responsible for actually instantiating the Rust WebAssembly
// module and providing the exports to the rest of glimmer. Most functions are
// exported directly from the WebAssembly module but a few are wrapped in a
// relatively low-level interface here.

import instantiate from "./rust"; // this is the fn to instantiate the module
import { Heap, Opcode } from "@glimmer/program";
import { WasmExterns, WasmProgram, WasmVM, WASM_APPEND_OPCODES } from "@glimmer/runtime";
import { Option, Opaque } from "@glimmer/interfaces";
import { assert } from "@glimmer/util";

let EXTERNS: Option<WasmExterns> = null;
let HEAP: Option<Heap> = null;
let PROGRAM: Option<WasmProgram> = null;
let VM: Option<WasmVM<Opaque>> = null;

function set_vm(vm: WasmVM<Opaque>) {
  assert(VM === null, 'vm is already set');
  VM = vm;
}

function set_program(program: WasmProgram) {
  assert(PROGRAM === null, 'program is already set');
  PROGRAM = program;
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

    low_level_vm_program_opcode(_program: number, offset: number): number {
      if (PROGRAM === null)
        throw new Error("program should have been set already");
      return PROGRAM.opcode(offset).offset;
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
      let mem = new Uint8Array(mod.memory.buffer);
      let slice = mem.slice(ptr, ptr + len);
      let s = new TextDecoder("utf-8").decode(slice);
      console.log(s);
    },
  },
};

const mod = instantiate(imports);

// reexport most exported functions in the module
export const {
  stack_new,
  stack_free,
  stack_copy,
  stack_write_raw,
  stack_write,
  stack_read_raw,
  stack_read,
  stack_reset,
  low_level_vm_new,
  low_level_vm_free,
  low_level_vm_current_op_size,
  low_level_vm_pc,
  low_level_vm_set_pc,
  low_level_vm_ra,
  low_level_vm_set_ra,
  low_level_vm_fp,
  low_level_vm_set_fp,
  low_level_vm_sp,
  low_level_vm_set_sp,
  low_level_vm_push_frame,
  low_level_vm_pop_frame,
  low_level_vm_return_to,
  low_level_vm_return,
  low_level_vm_call,
  low_level_vm_goto,
  low_level_vm_stack,
} = mod;

// Wrap a few functions to set our globals in this module above so while Rust is
// executing we have access to the various JS objects passed in.

export function low_level_vm_next_statement(vm: number,
                                            heap: Heap,
                                            program: WasmProgram) {
  try {
    set_heap(heap);
    set_program(program);
    let opcode = mod.low_level_vm_next_statement(vm);
    if (opcode === -1) {
      return null;
    } else {
      let op = new Opcode(heap);
      op.offset = opcode;
      return op;
    }
  } finally {
    HEAP = null;
    PROGRAM = null;
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
    mod.low_level_vm_evaluate(vm, opcode.offset, 0);
  } finally {
    VM = null;
    EXTERNS = null;
    HEAP = null;
    DEBUG_STATE = null;
  }
}
