import { Dict, NonemptyStack, Optional, Stack } from '@glimmer/interfaces';
import { ensureGuid, HasGuid } from './guid';

export interface Set<T> {
  add(value: T): Set<T>;
  delete(value: T): void;
}

export function dict<T = unknown>(): Dict<T> {
  return Object.create(null);
}

export function isDict<T>(u: T): u is Dict & T {
  return u !== null && u !== undefined;
}

export function isObject<T>(u: T): u is object & T {
  return typeof u === 'object' && u !== null;
}

export type SetMember = HasGuid | string;

export class DictSet<T extends SetMember> implements Set<T> {
  private dict: Dict<T>;

  constructor() {
    this.dict = dict<T>();
  }

  add(obj: T): Set<T> {
    if (typeof obj === 'string') this.dict[obj as any] = obj;
    else this.dict[ensureGuid(obj as any)] = obj;
    return this;
  }

  delete(obj: T) {
    if (typeof obj === 'string') delete this.dict[obj as any];
    else if ((obj as any)._guid) delete this.dict[(obj as any)._guid];
  }
}

export class StackImpl<T> implements Stack<T> {
  private stack: T[];
  public current: Optional<T> = null;

  constructor(values: T[] = []) {
    this.stack = values;
  }

  public get size() {
    return this.stack.length;
  }

  push(item: T) {
    this.current = item;
    this.stack.push(item);
  }

  pop(): Optional<T> {
    let item = this.stack.pop();
    let len = this.stack.length;
    this.current = len === 0 ? null : this.stack[len - 1];

    return item === undefined ? null : item;
  }

  nth(from: number): Optional<T> {
    let len = this.stack.length;
    return len < from ? null : this.stack[len - from];
  }

  isEmpty(): boolean {
    return this.stack.length === 0;
  }

  toArray(): T[] {
    return this.stack;
  }
}

export class NonemptyStackImpl<T> implements NonemptyStack<T> {
  private stack: [T, ...T[]];
  public current: T;

  constructor(values: [T, ...T[]]) {
    this.stack = values;
    this.current = values[values.length - 1];
  }

  public get size() {
    return this.stack.length;
  }

  push(item: T) {
    this.current = item;
    this.stack.push(item);
  }

  pop(): T {
    if (this.stack.length === 1) {
      throw new Error(`cannot pop the last element of a NonemptyStack`);
    }

    let item = this.stack.pop()!;
    let len = this.stack.length;
    this.current = this.stack[len - 1];

    return item;
  }

  nth(from: 0): T;
  nth(from: number): Optional<T>;
  nth(from: number): Optional<T> {
    let len = this.stack.length;
    return from >= len ? null : this.stack[from];
  }

  nthBack(from: number): Optional<T> {
    let len = this.stack.length;
    return len < from ? null : this.stack[len - from];
  }

  toArray(): [T, ...T[]] {
    return this.stack;
  }
}
