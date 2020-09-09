import { Optional } from './core';

export interface Stack<T> {
  current: Optional<T>;

  size: number;
  push(item: T): void;
  pop(): Optional<T>;
  nth(from: number): Optional<T>;
  isEmpty(): boolean;
  toArray(): T[];
}

export interface NonemptyStack<T> {
  current: T;

  size: number;
  push(item: T): void;
  pop(): T;
  nthBack(from: number): Optional<T>;
  toArray(): T[];
}
