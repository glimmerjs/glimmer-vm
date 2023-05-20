import type { Maybe, Present } from '@glimmer/interfaces';

export type Factory<T> = new (...args: unknown[]) => T;

export function keys<T extends object>(obj: T): Array<keyof T> {
  return Object.keys(obj) as Array<keyof T>;
}

type Unwrap = <T>(value: Maybe<T>) => T;

export const unwrap: Unwrap = import.meta.env.DEV
  ? <T>(value: Maybe<T>) => expect(value, `Expected value to be present`)
  : (((value) => value) as Unwrap);

type Expect = <T>(value: T, message: string) => Present<T>;

export const expect: Expect = import.meta.env.DEV
  ? <T>(value: T, message: string): Present<T> => {
      if (value === null || value === undefined) throw new Error(message);
      return value as Present<T>;
    }
  : (((value) => value) as Expect);

type Unreachable = (message?: string) => never;

export const unreachable: Unreachable = import.meta.env.DEV
  ? (message = 'unreachable'): never => {
      throw new Error(message);
    }
  : ((() => {}) as Unreachable);

type Exhausted = (value: never) => never;

export const exhausted: Exhausted = import.meta.env.DEV
  ? (value: never): never => {
      throw new Error(`Exhausted ${String(value)}`);
    }
  : (((_value: never) => {}) as Exhausted);
