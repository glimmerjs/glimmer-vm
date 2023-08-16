import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';

import type { ArgumentsStack } from './low-level';
import type { UnwindTarget } from './unwind';

import { PackedRegisters, Registers } from './low-level';

export default class EvaluationStackImpl implements ArgumentsStack {
  static restore(snapshot: unknown[], pc: number, unwind: UnwindTarget): EvaluationStackImpl {
    return new this(snapshot.slice(), PackedRegisters(pc, -1, -1, snapshot.length - 1, unwind));
  }

  readonly registers: Registers;

  // fp -> sp
  private constructor(
    private stack: unknown[] = [],
    registers: PackedRegisters
  ) {
    this.registers = new Registers(registers);

    if (LOCAL_DEBUG) {
      Object.seal(this);
    }
  }

  get size(): number {
    return this.stack.length;
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

  top<T>(offset = 0): T {
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

  /**
   * @snapshots
   */
  frame() {
    return this.stack.slice(
      this.registers.fp === -1 ? 0 : this.registers.fp,
      this.registers.sp + 1
    );
  }

  /**
   * @snapshots
   */
  all(): { before: unknown[]; frame: unknown[] } {
    let before = this.stack.slice(0, this.registers.fp === -1 ? 0 : this.registers.fp);
    return { before, frame: this.frame() };
  }
}
