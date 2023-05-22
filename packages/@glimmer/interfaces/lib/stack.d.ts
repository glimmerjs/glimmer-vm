import type { PresentArray } from '..';
import type { Nullable } from './core';

export interface Stack<T> {
  current: Nullable<T>;

  size: number;
  push(item: T): void;
  pop(): Nullable<T>;
  nth(from: number): Nullable<T>;
  isEmpty(): boolean;
  toArray(): T[];
}

export interface PresentStack<T> extends Stack<T> {
  current: T;

  size: number;
  push(item: T): void;
  pop(): T;
  nth(from: number): T;
  isEmpty(): false;
  toArray(): PresentArray<T>;

  replace(value: T): void;
}
