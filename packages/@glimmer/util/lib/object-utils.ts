import type { Dict, Expand } from '@glimmer/interfaces';

export let assign = Object.assign;

export function array<T>(): {
  allocate: <N extends number>(size: N) => Expand<FixedArray<T | null, N>>;
} {
  return {
    allocate: <N extends number>(size: N) => Array(size).fill(null) as Expand<FixedArray<T | null, N>>,
  };
}

type Grow<T, A extends Array<T>> = ((x: T, ...xs: A) => void) extends (...a: infer X) => void
  ? X
  : never;
type GrowToSize<T, A extends Array<T>, N extends number> = {
  0: A;
  1: GrowToSize<T, Grow<T, A>, N>;
}[A['length'] extends N ? 0 : 1];

export type FixedArray<T, N extends number> = GrowToSize<T, [], N>;

export function values<T>(obj: { [s: string]: T }): T[] {
  return Object.values(obj);
}

export type ObjectEntry<D extends object> = { [P in keyof D]: [P, D[P]] }[keyof D];

export function entries<D extends object>(dict: D): ObjectEntry<D>[] {
  return Object.entries(dict) as ObjectEntry<D>[];
}

export function mapDict<T, U>(dict: Dict<T>, mapper: (value: T) => U): Dict<U> {
  return Object.fromEntries(entries(dict).map(([k, v]) => [k, mapper(v)])) as Dict<U>;
}
