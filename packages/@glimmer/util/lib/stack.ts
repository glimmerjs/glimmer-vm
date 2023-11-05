import type { Nullable, Stack as StackInterface } from '@glimmer/interfaces';

import { assert } from './assert';

class AbstractStack<
    T extends unknown[],
    Pop extends Nullable<T[number]>,
    Current extends Nullable<T[number]>,
  >
  implements Stack<T[number]>, Iterable<T[number]>
{
  readonly #stack: T;
  declare label?: string | undefined;

  protected constructor(stack: T, label?: string | undefined) {
    this.#stack = stack;

    if (import.meta.env.DEV) {
      this.label = label;
    }
  }

  *[Symbol.iterator]() {
    yield* this.#stack;
  }

  get current(): Current {
    return (this.#stack.at(-1) ?? null) as Current;
  }

  get size(): T['length'] {
    return this.#stack.length;
  }

  push(item: T[number]): void {
    this.#stack.push(item);
  }

  pop(): Pop {
    return (this.#stack.pop() ?? null) as Pop;
  }

  nth(from: number): Current {
    assert(from < this.#stack.length, `Index ${from} is out of bounds`);
    return (this.#stack.at(-from) ?? null) as Current;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isEmpty(this: AbstractStack<[T, ...T[]], any, any>): false;
  isEmpty(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.#stack.length === 0) as any;
  }

  asArray(): T {
    return this.#stack;
  }
}

export class StackImpl<T> extends AbstractStack<T[], Nullable<T>, Nullable<T>> {
  static empty<T>(label?: string | undefined): Stack<T> {
    return new StackImpl([], label) as Stack<T>;
  }
}
/**
 * A balanced stack is allowed to be empty, but it should never be popped unless there's something
 * in it.
 */

export class BalancedStack<T> extends AbstractStack<T[], T, Nullable<T>> {
  static empty<T>(label?: string | undefined): BalancedStack<T> {
    return import.meta.env.DEV ? new BalancedStack([], label) : new BalancedStack([]);
  }

  static initial<T>(value: T, label?: string | undefined): BalancedStack<T> {
    return import.meta.env.DEV ? new BalancedStack([value], label) : new BalancedStack([value]);
  }

  get present(): T {
    assert(this.current, `BUG: Expected an item in the ${this.label ?? 'stack'}`);
    return this.current;
  }

  override pop(): T {
    assert(
      super.asArray().length >= 1,
      `BUG: Unbalanced ${this.label ?? 'stack'}: attempted to pop an item but no item was pushed`
    );
    return super.pop();
  }
}

export class PresentStackImpl<T, Tup extends [T, ...T[]]> extends AbstractStack<Tup, T, T> {
  static initial<T>(value: T, label?: string | undefined): PresentStackImpl<T, [T]> {
    return import.meta.env.DEV
      ? new PresentStackImpl([value], label)
      : new PresentStackImpl([value]);
  }

  override pop(): T {
    assert(
      super.asArray().length > 1,
      `BUG: You should never pop the last frame from a ${this.label ?? 'PresentStack'}`
    );
    return super.pop();
  }
}

export type Stack<T> = StackInterface<T>;
export const Stack = StackImpl;

export type PresentStack<T> = PresentStackImpl<T, [T, ...T[]]>;
export const PresentStack = PresentStackImpl;
