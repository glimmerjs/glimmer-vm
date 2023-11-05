import type { Nullable, Stack as StackInterface } from '@glimmer/interfaces';

import { assert } from './assert';

abstract class AbstractStack<
    T extends unknown[],
    Pop extends Nullable<T[number]>,
    Current extends Nullable<T[number]>,
  >
  implements Stack<T[number]>, Iterable<T[number]>
{
  readonly #stack: T;
  readonly #parent: Nullable<this>;
  declare label?: string | undefined;

  protected constructor(
    stack: T,
    parent: Nullable<AbstractStack<T, Pop, Current>>,
    label?: string | undefined
  ) {
    this.#stack = stack;
    this.#parent = parent as Nullable<this>;

    if (import.meta.env.DEV) {
      this.label = label;
    }
  }

  *[Symbol.iterator](): IterableIterator<T[number]> {
    yield* this.#stack;
  }

  get current(): Current {
    if (this.#stack.length === 0 && this.#parent) {
      return this.#parent.current;
    }

    return (this.#stack.at(-1) ?? null) as Current;
  }

  get size(): T['length'] {
    return this.#stack.length + (this.#parent ? this.#parent.size : 0);
  }

  protected get hasParent(): boolean {
    return !!this.#parent;
  }

  protected get frameHasItems(): boolean {
    return this.#stack.length > 0;
  }

  protected abstract child(): this;

  begin(): this {
    return this.child();
  }

  rollback(): this {
    assert(this.#parent, `${this.label ?? 'Stack'}: Expected a parent frame in unwind`);
    return this.#parent;
  }

  finally(): this {
    assert(
      this.#stack.length === 0,
      `${this.label ?? 'Stack'}: Expected an empty frame in finally `
    );
    assert(this.#parent, `${this.label ?? 'Stack'}: Expected a parent frame in finally`);

    return this.#parent;
  }

  push(item: T[number]): void {
    this.#stack.push(item);
  }

  pop(): Pop {
    assert(
      // this is annoying but we need to write it this way to get good errors and get `asserts
      // condition` to work correctly.
      !(!this.frameHasItems && this.#parent),
      `BUG: Unbalanced frame in ${
        this.label ?? 'stack'
      }: attempted to pop an item but no item was pushed. Call unwind() or finally() first`
    );

    assert(
      this.frameHasItems,
      `BUG: Unbalanced ${this.label ?? 'stack'}: attempted to pop an item but no item was pushed`
    );
    return (this.#stack.pop() ?? null) as Pop;
  }

  nth(from: number): Current {
    assert(from < this.size, `Index ${from} is out of bounds`);

    if (from < this.#stack.length) {
      return this.#stack.at(-from - 1) as Current;
    } else if (this.#parent) {
      return this.#parent.nth(from - this.#stack.length);
    } else {
      return null as Current;
    }
  }

  toArray(): T {
    const prefix = this.#parent ? [...this.#parent.toArray()] : [];
    return [...prefix, ...this.#stack] as T;
  }
}

export class StackImpl<T> extends AbstractStack<T[], Nullable<T>, Nullable<T>> {
  static empty<T>(label?: string | undefined): Stack<T> {
    return new StackImpl([], null, label) as Stack<T>;
  }

  protected override child(): this {
    return new StackImpl([], this, this.label) as this;
  }
}

/**
 * A balanced stack is allowed to be empty, but it should never be popped unless there's something
 * in it.
 */

export class BalancedStack<T> extends AbstractStack<T[], T, Nullable<T>> implements Stack<T> {
  static empty<T>(label?: string | undefined): BalancedStack<T> {
    return import.meta.env.DEV
      ? new BalancedStack([], null, label ?? 'balanced stack')
      : new BalancedStack([], null);
  }

  static initial<T>(value: T, label?: string | undefined): BalancedStack<T> {
    return import.meta.env.DEV
      ? new BalancedStack([value], null, label)
      : new BalancedStack([value], null);
  }

  child(): this {
    return new BalancedStack([], this, this.label) as this;
  }

  get present(): T {
    assert(this.current, `BUG: Expected an item in the ${this.label ?? 'stack'}`);
    return this.current;
  }
}

export class PresentStack<T> extends AbstractStack<[T, ...T[]], T, T> {
  static initial<T>(value: T, label?: string | undefined): PresentStack<T> {
    return import.meta.env.DEV
      ? new PresentStack([value], null, label ?? 'present stack')
      : new PresentStack([value], null);
  }

  child(): this {
    return new PresentStack([] as any, this, this.label) as this;
  }

  override pop(): T {
    try {
      return super.pop();
    } finally {
      assert(
        super.size > 0,
        `BUG: You should never pop the last item from a ${this.label ?? 'PresentStack'}`
      );
    }
  }
}

export type Stack<T> = StackInterface<T>;
export const Stack = StackImpl;
