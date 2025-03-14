import type { Program, ProgramConstants, ProgramHeap, StdLibOperand } from '@glimmer/interfaces';
import { unwrap } from '@glimmer/debug-util';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { MACHINE_MASK } from '@glimmer/vm';

import { RuntimeOpImpl } from './opcode';

const ALLOCATED = 0;
const FREED = 1;
const PURGED = 2;
const POINTER = 3;

type TableSlotState = typeof ALLOCATED | typeof FREED | typeof PURGED | typeof POINTER;

export type Placeholder = [number, () => number];
export type StdlibPlaceholder = [number, StdLibOperand];

const PAGE_SIZE = 0x100000;

/**
 * The Program Heap is responsible for dynamically allocating
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
export class ProgramHeapImpl implements ProgramHeap {
  offset = 0;

  private heap: Int32Array;
  private handleTable: number[];
  private handleState: TableSlotState[];
  private handle = 0;

  constructor() {
    this.heap = new Int32Array(PAGE_SIZE);
    this.handleTable = [];
    this.handleState = [];
  }
  entries(): number {
    return this.offset;
  }

  pushRaw(value: number): void {
    this.sizeCheck();
    this.heap[this.offset++] = value;
  }

  pushOp(item: number): void {
    this.pushRaw(item);
  }

  pushMachine(item: number): void {
    this.pushRaw(item | MACHINE_MASK);
  }

  private sizeCheck() {
    let { heap } = this;

    if (this.offset === this.heap.length) {
      let newHeap = new Int32Array(heap.length + PAGE_SIZE);
      newHeap.set(heap, 0);
      this.heap = newHeap;
    }
  }

  getbyaddr(address: number): number {
    return unwrap(this.heap[address]);
  }

  setbyaddr(address: number, value: number) {
    this.heap[address] = value;
  }

  malloc(): number {
    // push offset, info, size
    this.handleTable.push(this.offset);
    return this.handleTable.length - 1;
  }

  finishMalloc(handle: number): void {
    // @TODO: At the moment, garbage collection isn't actually used, so this is
    // wrapped to prevent us from allocating extra space in prod. In the future,
    // if we start using the compact API, we should change this.
    if (LOCAL_DEBUG) {
      this.handleState[handle] = ALLOCATED;
      this.handleTable[handle + 1] = this.offset;
    }
  }

  size(): number {
    return this.offset;
  }

  // It is illegal to close over this address, as compaction
  // may move it. However, it is legal to use this address
  // multiple times between compactions.
  getaddr(handle: number): number {
    return unwrap(this.handleTable[handle]);
  }

  sizeof(handle: number): number {
    return sizeof(this.handleTable, handle);
  }

  free(handle: number): void {
    this.handleState[handle] = FREED;
  }

  /**
   * The heap uses the [Mark-Compact Algorithm](https://en.wikipedia.org/wiki/Mark-compact_algorithm) to shift
   * reachable memory to the bottom of the heap and freeable
   * memory to the top of the heap. When we have shifted all
   * the reachable memory to the top of the heap, we move the
   * offset to the next free position.
   */
  compact(): void {
    let compactedSize = 0;
    let { handleTable, handleState, heap } = this;

    for (let i = 0; i < length; i++) {
      let offset = unwrap(handleTable[i]);
      let size = unwrap(handleTable[i + 1]) - unwrap(offset);
      let state = handleState[i];

      if (state === PURGED) {
        continue;
      } else if (state === FREED) {
        // transition to "already freed" aka "purged"
        // a good improvement would be to reuse
        // these slots
        handleState[i] = PURGED;
        compactedSize += size;
      } else if (state === ALLOCATED) {
        for (let j = offset; j <= i + size; j++) {
          heap[j - compactedSize] = unwrap(heap[j]);
        }

        handleTable[i] = offset - compactedSize;
      } else if (state === POINTER) {
        handleTable[i] = offset - compactedSize;
      }
    }

    this.offset = this.offset - compactedSize;
  }
}

export class ProgramImpl implements Program {
  [key: number]: never;

  private _opcode: RuntimeOpImpl;

  constructor(
    public constants: ProgramConstants,
    public heap: ProgramHeap
  ) {
    this._opcode = new RuntimeOpImpl(this.heap);
  }

  opcode(offset: number): RuntimeOpImpl {
    this._opcode.offset = offset;
    return this._opcode;
  }
}

function sizeof(table: number[], handle: number) {
  if (LOCAL_DEBUG) {
    return unwrap(table[handle + 1]) - unwrap(table[handle]);
  } else {
    return -1;
  }
}
