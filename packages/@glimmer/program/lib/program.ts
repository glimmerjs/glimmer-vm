import type {
  CompileTimeHeap,
  ResolutionTimeConstants,
  RuntimeConstants,
  RuntimeHeap,
  RuntimeProgram,
  SerializedHeap,
  StdLibraryOperand,
} from '@glimmer/interfaces';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { expect, unwrap } from '@glimmer/util';
import { MACHINE_MASK } from '@glimmer/vm-constants';

import { RuntimeOpImpl } from './opcode';

const ALLOCATED_SLOT = 0;
const FREED_SLOT = 1;

type TableSlotState = 0 | 1;

export type Placeholder = [number, () => number];
export type StdlibPlaceholder = [number, StdLibraryOperand];

const PAGE_SIZE = 0x10_00_00;

export class RuntimeHeapImpl implements RuntimeHeap {
  readonly #heap: Int32Array;
  readonly #table: number[];

  constructor(serializedHeap: SerializedHeap) {
    let { buffer, table } = serializedHeap;
    this.#heap = new Int32Array(buffer);
    this.#table = table;
  }

  // It is illegal to close over this address, as compaction
  // may move it. However, it is legal to use this address
  // multiple times between compactions.
  getaddr(handle: number): number {
    return unwrap(this.#table[handle]);
  }

  getbyaddr(address: number): number {
    return expect(this.#heap[address], 'Access memory out of bounds of the heap');
  }

  sizeof(handle: number): number {
    return sizeof(this.#table, handle);
  }
}

export function hydrateHeap(serializedHeap: SerializedHeap): RuntimeHeap {
  return new RuntimeHeapImpl(serializedHeap);
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
 * | ... | hp (u32) |       info (u32)   | size (u32) |
 * | ... |  Handle  | Scope Size | State | Size       |
 * | ... | 32bits   | 30bits     | 2bits | 32bit      |
 *
 * With this information we effectively have the ability to
 * control when we want to free memory. That being said you
 * can not free during execution as raw address are only
 * valid during the execution. This means you cannot close
 * over them as you will have a bad memory access exception.
 */
export class HeapImpl implements CompileTimeHeap, RuntimeHeap {
  offset = 0;

  #heap: Int32Array;
  readonly #handleTable: number[];
  readonly #handleState: TableSlotState[];
  readonly #handle = 0;

  declare readonly capture?: (offset?: number) => SerializedHeap;

  constructor() {
    this.#heap = new Int32Array(PAGE_SIZE);
    this.#handleTable = [];
    this.#handleState = [];

    if (import.meta.env.DEV) {
      Object.defineProperty(this, 'capture', {
        enumerable: false,
        configurable: true,
        writable: false,
        value: (offset = this.offset): SerializedHeap => {
          // Only called in eager mode
          let buffer = this.#heap.slice(0, offset).buffer;
          return {
            handle: this.#handle,
            table: this.#handleTable,
            buffer: buffer as ArrayBuffer,
          };
        },
      });
    }
  }

  pushRaw(value: number): void {
    this.#growIfNeeded();
    this.#heap[this.offset++] = value;
  }

  pushOp(item: number): void {
    this.pushRaw(item);
  }

  pushMachine(item: number): void {
    this.pushRaw(item | MACHINE_MASK);
  }

  #growIfNeeded() {
    const heap = this.#heap;
    if (this.offset === heap.length) {
      let newHeap = new Int32Array(heap.length + PAGE_SIZE);
      newHeap.set(heap, 0);
      this.#heap = newHeap;
    }
  }

  getbyaddr(address: number): number {
    return unwrap(this.#heap[address]);
  }

  setbyaddr(address: number, value: number) {
    this.#heap[address] = value;
  }

  malloc(): number {
    // push offset, info, size
    this.#handleTable.push(this.offset);
    return this.#handleTable.length - 1;
  }

  finishMalloc(handle: number): void {
    // @TODO: At the moment, garbage collection isn't actually used, so this is
    // wrapped to prevent us from allocating extra space in prod. In the future,
    // if we start using the compact API, we should change this.
    if (import.meta.env.DEV && LOCAL_DEBUG) {
      this.#handleState[handle] = ALLOCATED_SLOT;
    }
  }

  // It is illegal to close over this address, as compaction
  // may move it. However, it is legal to use this address
  // multiple times between compactions.
  getaddr(handle: number): number {
    return unwrap(this.#handleTable[handle]);
  }

  sizeof(handle: number): number {
    return sizeof(this.#handleTable, handle);
  }

  free(handle: number): void {
    this.#handleState[handle] = FREED_SLOT;
  }
}

export class RuntimeProgramImpl implements RuntimeProgram {
  [key: number]: never;

  readonly #opcode: RuntimeOpImpl;

  constructor(
    public constants: RuntimeConstants & ResolutionTimeConstants,
    public heap: RuntimeHeap
  ) {
    this.#opcode = new RuntimeOpImpl(this.heap);
  }

  opcode(offset: number): RuntimeOpImpl {
    this.#opcode.offset = offset;
    return this.#opcode;
  }
}

function sizeof(table: number[], handle: number) {
  return import.meta.env.DEV && LOCAL_DEBUG
    ? unwrap(table[handle + 1]) - unwrap(table[handle])
    : -1;
}
