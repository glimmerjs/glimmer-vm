import { localAssert } from '@glimmer/debug-util';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { $fp, $pc, $sp } from '@glimmer/vm';

import type { LowLevelRegisters } from './low-level';

import { initializeRegistersWithSP } from './low-level';

export interface EvaluationStack {
  readonly registers: LowLevelRegisters;

  push(value: unknown): void;
  dup(position?: number): void;
  copy(from: number, to: number): void;
  pop<T>(n?: number): T;
  peek<T>(offset?: number): T;
  get<T>(offset: number, base?: number): T;
  set(value: unknown, offset: number, base?: number): void;
  slice<T = unknown>(start: number, end: number): T[];
  capture(items: number): unknown[];
  reset(): void;

  snapshot?(): unknown[];
}

export default class EvaluationStackImpl implements EvaluationStack {
  static restore(snapshot: unknown[], pc: number): EvaluationStackImpl {
    const stack = new this(snapshot.slice(), initializeRegistersWithSP(snapshot.length - 1));

    localAssert(typeof pc === 'number', 'pc is a number');

    stack.registers[$pc] = pc;
    stack.registers[$sp] = snapshot.length - 1;
    stack.registers[$fp] = -1;

    return stack;
  }

  readonly registers: LowLevelRegisters;

  // fp -> sp
  constructor(
    private stack: unknown[] = [],
    registers: LowLevelRegisters
  ) {
    this.registers = registers;

    if (LOCAL_DEBUG) {
      this.snapshot = () => {
        const fpRegister = this.registers[$fp];
        const fp = fpRegister === -1 ? 0 : fpRegister;
        return this.stack.slice(fp, this.registers[$sp] + 1);
      };
      Object.seal(this);
    }
  }

  push(value: unknown): void {
    this.stack[++this.registers[$sp]] = value;
  }

  dup(position = this.registers[$sp]): void {
    this.stack[++this.registers[$sp]] = this.stack[position];
  }

  copy(from: number, to: number): void {
    this.stack[to] = this.stack[from];
  }

  pop<T>(n = 1): T {
    let top = this.stack[this.registers[$sp]] as T;
    this.registers[$sp] -= n;
    return top;
  }

  peek<T>(offset = 0): T {
    return this.stack[this.registers[$sp] - offset] as T;
  }

  get<T>(offset: number, base = this.registers[$fp]): T {
    return this.stack[base + offset] as T;
  }

  set(value: unknown, offset: number, base = this.registers[$fp]) {
    this.stack[base + offset] = value;
  }

  slice<T = unknown>(start: number, end: number): T[] {
    return this.stack.slice(start, end) as T[];
  }

  capture(items: number): unknown[] {
    let end = this.registers[$sp] + 1;
    let start = end - items;
    return this.stack.slice(start, end);
  }

  reset() {
    this.stack.length = 0;
  }

  declare snapshot?: (this: EvaluationStackImpl) => unknown[];

  static {
    if (LOCAL_DEBUG) {
      EvaluationStackImpl.prototype.snapshot = function () {
        return this.stack.slice(this.registers[$fp], this.registers[$sp] + 1);
      };
    }
  }
}
