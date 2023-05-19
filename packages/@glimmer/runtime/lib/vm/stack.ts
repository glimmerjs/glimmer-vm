import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { $fp, $sp, type MachineRegister } from '@glimmer/vm-constants';

import { initializeRegistersWithSP, type LowLevelRegisters } from './low-level';

export interface EvaluationStack {
  readonly _registers_: LowLevelRegisters;

  push(...values: unknown[]): void;
  dup(position?: MachineRegister): void;
  copy(from: number, to: number): void;
  pop<T>(n?: number): T;
  peek<T>(offset?: number): T;
  get<T>(offset: number, base?: number): T;
  set(value: unknown, offset: number, base?: number): void;
  slice<T = unknown>(start: number, end: number): T[];
  capture(items: number): unknown[];
  reset(): void;
  toArray(): unknown[];
}

export default class EvaluationStackImpl implements EvaluationStack {
  static restore(snapshot: unknown[]): EvaluationStackImpl {
    return new this([...snapshot], initializeRegistersWithSP(snapshot.length - 1));
  }

  readonly _registers_: LowLevelRegisters;
  readonly #stack: unknown[];

  // fp -> sp
  constructor(stack: unknown[] = [], registers: LowLevelRegisters) {
    this.#stack = stack;
    this._registers_ = registers;

    if (import.meta.env.DEV && LOCAL_DEBUG) {
      Object.seal(this);
    }
  }

  push(...values: unknown[]): void {
    for (const value of values) {
      this.#stack[++this._registers_[$sp]] = value;
    }
  }

  dup(position = this._registers_[$sp]): void {
    this.#stack[++this._registers_[$sp]] = this.#stack[position];
  }

  copy(from: number, to: number): void {
    this.#stack[to] = this.#stack[from];
  }

  pop<T>(n = 1): T {
    let top = this.#stack[this._registers_[$sp]] as T;
    this._registers_[$sp] -= n;
    return top;
  }

  peek<T>(offset = 0): T {
    return this.#stack[this._registers_[$sp] - offset] as T;
  }

  get<T>(offset: number, base = this._registers_[$fp]): T {
    return this.#stack[base + offset] as T;
  }

  set(value: unknown, offset: number, base = this._registers_[$fp]) {
    this.#stack[base + offset] = value;
  }

  slice<T = unknown>(start: number, end: number): T[] {
    return this.#stack.slice(start, end) as T[];
  }

  capture(items: number): unknown[] {
    let end = this._registers_[$sp] + 1;
    let start = end - items;
    return this.#stack.slice(start, end);
  }

  reset() {
    this.#stack.length = 0;
  }

  toArray() {
    return this.#stack.slice(this._registers_[$fp], this._registers_[$sp] + 1);
  }
}
