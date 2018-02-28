
import { CompileTimeProgram, Recast, VMHandle, RuntimeResolver, CompileTimeHeap } from "@glimmer/interfaces";
import { Constants, WriteOnlyConstants, RuntimeConstants, ConstantPool } from './constants';
import { Opcode } from './opcode';
import { assert } from "@glimmer/util";
import { Opaque } from "@glimmer/interfaces";
import { WasmHeap, wasmMemory } from '@glimmer/low-level';

export interface Opcodes {
  evaluate(vm: Opaque, offset: number): void;
}

export interface Externs {
  debugBefore(offset: number): Opaque;
  debugAfter(offset: number, state: Opaque): void;
}

const MAX_SIZE = 0b1111111111111111;

export interface SerializedHeap {
  buffer: ArrayBuffer;
  table: number[];
  handle: number;
}

export type Placeholder = [number, () => number];

// See comment in `test/index.html` for why we keep track of this and why it
// exists.
let WASM_PROGRAMS: WasmHeap[] = [];

export function freeAllWasmPrograms() {
  for (let i = 0; i < WASM_PROGRAMS.length; i++)
    WASM_PROGRAMS[i].free();
  WASM_PROGRAMS = [];
}

/**
 * The Heap is responsible for dynamically allocating
 * memory in which we read/write the VM's instructions
 * from/to. When we malloc we pass out a VMHandle, which
 * is used as an indirect way of accessing the memory during
 * execution of the VM. Internally we track the different
 * regions of the memory in an int array known as the table.
 *
 * The table 32-bit aligned and has the following layout:
 *
 * | ... | hp (u32) |       info (u32)          |
 * | ... |  Handle  | Size | Scope Size | State |
 * | ... | 32-bits  | 16b  |    14b     |  2b   |
 *
 * With this information we effectively have the ability to
 * control when we want to free memory. That being said you
 * can not free during execution as raw address are only
 * valid during the execution. This means you cannot close
 * over them as you will have a bad memory access exception.
 */
export class Heap implements CompileTimeHeap {
  private placeholders: Placeholder[] = [];
  private wasmHeap: WasmHeap;

  constructor(serializedHeap?: SerializedHeap) {
    this.wasmHeap = WasmHeap.new();
    WASM_PROGRAMS.push(this.wasmHeap);
    if (serializedHeap) {
      let { buffer, table, handle } = serializedHeap;
      let heap = new Uint16Array(buffer);
      let ptr = this.wasmHeap.reserve(heap.length);
      (new Uint16Array(wasmMemory.buffer)).set(heap, ptr / 2);
      this.wasmHeap.set_offset(heap.length);

      // TODO: are these copies too slow?
      for (let i = 0; i < table.length; i++) {
        this.wasmHeap.table_write_raw(i, table[i]);
      }
      this.wasmHeap.set_table_len(table.length);
      this.wasmHeap.set_handle(handle);
    } else {
      this.wasmHeap.reserve(0x100000);
    }
  }

  _wasmHeap(): WasmHeap {
    return this.wasmHeap;
  }

  push(item: number): void {
    this.wasmHeap.push(item);
  }

  getbyaddr(address: number): number {
    return this.wasmHeap.get_by_addr(address);
  }

  setbyaddr(address: number, value: number) {
    return this.wasmHeap.set_by_addr(address, value);
  }

  malloc(): number {
    return this.wasmHeap.malloc_handle();
  }

  finishMalloc(handle: number, scopeSize: number): void {
    return this.wasmHeap.finish_malloc(handle, scopeSize);
  }

  size(): number {
    return this.wasmHeap.size();
  }

  // It is illegal to close over this address, as compaction
  // may move it. However, it is legal to use this address
  // multiple times between compactions.
  getaddr(handle: number): number {
    return this.wasmHeap.get_addr(handle);
  }

  gethandle(address: number): number {
    return this.wasmHeap.get_handle(address);
  }

  sizeof(handle: number): number {
    return this.wasmHeap.size_of(handle);
  }

  scopesizeof(handle: number): number {
    return this.wasmHeap.scope_size_of(handle);
  }

  free(handle: VMHandle): void {
    return this.wasmHeap.free_handle(handle as Recast<VMHandle, number>);
  }

  compact(): void {
    this.wasmHeap.compact();
  }

  pushPlaceholder(valueFunc: () => number): void {
    const address = this.wasmHeap.push_placeholder();
    this.placeholders.push([address, valueFunc]);
  }

  private patchPlaceholders() {
    let { placeholders } = this;

    for (let i = 0; i < placeholders.length; i++) {
      let [address, getValue] = placeholders[i];

      assert(this.getbyaddr(address) === MAX_SIZE, `expected to find a placeholder value at ${address}`);
      this.setbyaddr(address, getValue());
    }
  }

  capture(): SerializedHeap {
    this.patchPlaceholders();

    let table = [];
    let len = this.wasmHeap.table_len();
    for (let i = 0; i < len; i++) {
      table.push(this.wasmHeap.table_read_raw(i));
    }

    // Only called in eager mode
    let dst = new Uint16Array(this.size());
    let start = this.wasmHeap.heap() / 2;
    let end = start + this.size();
    let src = (new Uint16Array(wasmMemory.buffer)).slice(start, end);
    dst.set(src);
    return {
      handle: this.wasmHeap.handle(),
      table: table,
      buffer: dst.buffer as ArrayBuffer
    };
  }
}

export class WriteOnlyProgram implements CompileTimeProgram {
  [key: number]: never;

  private _opcode: Opcode;

  constructor(public constants: WriteOnlyConstants = new WriteOnlyConstants(), public heap = new Heap()) {
    this._opcode = new Opcode(this.heap);
  }

  opcode(offset: number): Opcode {
    this._opcode.offset = offset;
    return this._opcode;
  }
}

export class RuntimeProgram<Locator> {
  [key: number]: never;

  static hydrate<Locator>(rawHeap: SerializedHeap, pool: ConstantPool, resolver: RuntimeResolver<Locator>) {
    let heap = new Heap(rawHeap);
    let constants = new RuntimeConstants(resolver, pool);

    return new RuntimeProgram(constants, heap);
  }

  private _opcode: Opcode;

  constructor(public constants: RuntimeConstants<Locator>, public heap: Heap) {
    this._opcode = new Opcode(this.heap);
  }

  opcode(offset: number): Opcode {
    this._opcode.offset = offset;
    return this._opcode;
  }
}

export class Program<Locator> extends WriteOnlyProgram {
  public constants: Constants<Locator>;
}
