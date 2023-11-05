import type { Nullable } from './core';

export interface Stack<in out T> extends Iterable<T> {
  current: Nullable<T>;

  size: number;
  push(item: T): void;
  pop(): Nullable<T>;
  nth(from: number): Nullable<T>;
  isEmpty(): true | false;

  /**
   * Return the stack as an array, **without snapshotting it**. Mutating the returned array will
   * mutate the underlying stack array and is unsafe.
   */
  asArray(): T[];
}

export interface StackWithTransaction<T> extends Stack<T> {
  begin(): StackTransaction<Stack<T>, Stack<T>, T>;
}

export interface StackTransaction<Commit extends Stack<T>, Rollback extends Stack<T>, T>
  extends Stack<T> {
  commit(): Commit;
  rollback(): Rollback;
}
