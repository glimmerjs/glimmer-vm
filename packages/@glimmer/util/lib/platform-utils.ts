import type { Maybe, Present } from '@glimmer/interfaces';

export type Factory<T> = new (...args: unknown[]) => T;

export function keys<T extends object>(obj: T): Array<keyof T> {
  return Object.keys(obj) as Array<keyof T>;
}

type Unwrap = <T>(val: Maybe<T>) => T;

export const unwrap: Unwrap = import.meta.env.DEV
  ? <T>(val: Maybe<T>) => expect(val, `Expected value to be present`)
  : (((val) => val) as Unwrap);

type Expect = <T>(val: T, message: string) => Present<T>;

export const expect: Expect = import.meta.env.DEV
  ? <T>(val: T, message: string): Present<T> => {
      if (val === null || val === undefined) throw Error(message);
      return val as Present<T>;
    }
  : (((val) => val) as Expect);

type Unreachable = (message?: string) => never;

export const unreachable: Unreachable = import.meta.env.DEV
  ? (message = 'unreachable'): never => {
      throw Error(message);
    }
  : ((() => {}) as Unreachable);

type Exhausted = (value: never) => never;

export const exhausted: Exhausted = import.meta.env.DEV
  ? (value: never): never => {
      throw Error(`Exhausted ${String(value)}`);
    }
  : (((_value: never) => {}) as Exhausted);
