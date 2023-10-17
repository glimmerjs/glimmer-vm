import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';

import {
  initializeRegistersWithSP,
  Registers,
  type PackedRegisters,
  type InternalStack,
} from './low-level';

export default class EvaluationStackImpl implements InternalStack {
  static restore(snapshot: unknown[]): EvaluationStackImpl {
    return new this(snapshot.slice(), initializeRegistersWithSP(snapshot.length - 1));
  }

  readonly registers: Registers;

  // fp -> sp
  constructor(
    private stack: unknown[] = [],
    registers: PackedRegisters
  ) {
    this.registers = new Registers(registers);

    if (LOCAL_DEBUG) {
      Object.seal(this);
    }
  }

  push(...values: unknown[]): void {
    for (let value of values) {
      this.stack[this.registers.push()] = value;
    }
  }

  dup(position = this.registers.sp): void {
    this.stack[this.registers.push()] = this.stack[position];
  }

  copy(from: number, to: number): void {
    this.stack[to] = this.stack[from];
  }

  pop<T>(n = 1): T {
    let top = this.stack[this.registers.sp] as T;
    this.registers.pop(n);
    return top;
  }

  peek<T>(offset = 0): T {
    return this.stack[this.registers.peek(offset)] as T;
  }

  get<T>(offset: number, base = this.registers.fp): T {
    return this.stack[base + offset] as T;
  }

  set(value: unknown, offset: number, base = this.registers.fp) {
    this.stack[base + offset] = value;
  }

  slice<T = unknown>(start: number, end: number): T[] {
    return this.stack.slice(start, end) as T[];
  }

  capture(items: number): unknown[] {
    let end = this.registers.sp + 1;
    let start = end - items;
    return this.stack.slice(start, end);
  }

  reset() {
    this.stack.length = 0;
  }

  toArray() {
    return this.stack.slice(this.registers.fp, this.registers.sp + 1);
  }
}
