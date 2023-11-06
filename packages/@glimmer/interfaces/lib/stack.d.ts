import type { VmStackAspect } from '..';
import type { Nullable } from './core';

export interface Stack<in out T> extends Iterable<T>, VmStackAspect {
  readonly current: Nullable<T>;
  readonly size: number;
  push(item: T): void;
  pop(): Nullable<T>;

  /**
   * Returns the nth value (0-indexed) from the end. For example, if the stack was:
   * `[1, 2, 3]`, `nth(0)` would return `3`, `nth(1)` would return `2`, and `nth(2)` would
   * return `1`.
   *
   * During a transaction, `nth()` can be used to access the items that were on the stack
   * before the transaction began.
   *
   * Returns `null` if the stack is empty.
   */
  nth(from: number): Nullable<T>;

  /**
   * Return the stack as a snapshotted array. In a transaction, `toArray()` returns the entire
   * stack, including the items that were on the stack before the transaction began.
   */
  toArray(): T[];

  /**
   * Creates (and returns) a new tranactional stack. Pushes to the transactional stack will work as
   * normal. Popping past the start of the transaction will throw an error.
   *
   * The expected usage pattern is:
   *
   * 1. `begin()` returns a new stack
   * 2. pushes and pops inside the stack are balanced
   * 3. call `finally()` after making all changes
   *   a. alternatively, call `rollback()` if you want to abandon any pushes made during the
   *      transaction.
   *
   * You call `finally()` at the end of the balanced operations made during the transaction. After
   * `finally`, you can pop items from the original stack.
   *
   * You call `rollback()` if you want to abandon any pushes made during the transaction. It returns
   * the original stack, and allows you to abandon pushes without balanced pops.
   *
   * Nested transactions are allowed.
   */
  begin(): this;

  /**
   * Rolls back the stack to its state before the most recent call to `begin()`. This allows you to
   * abandon any unbalanced pushes.
   *
   * `rollback()` returns the original stack.
   */
  catch(): this;

  /**
   * Validates that there were balanced pushes and pops during the transaction and returns the
   * original stack.
   */
  finally(): this;
}
