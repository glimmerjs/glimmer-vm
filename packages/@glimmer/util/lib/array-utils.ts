export const EMPTY_ARRAY: readonly unknown[] = readonly([]);

function readonly<T>(value: T): Readonly<T> {
  if (import.meta.env.DEV) {
    return Object.freeze(value);
  }

  return value as Readonly<T>;
}

export function emptyArray<T>(): T[] {
  return EMPTY_ARRAY as T[];
}

export const EMPTY_STRING_ARRAY = emptyArray<string>();
export const EMPTY_NUMBER_ARRAY = emptyArray<number>();

/**
 * This function returns `true` if the input array is the special empty array sentinel,
 * which is sometimes used for optimizations.
 */
export function isEmptyArray(input: unknown[] | readonly unknown[]): boolean {
  return input === EMPTY_ARRAY;
}

/**
 * This function does a better job of narrowing values to arrays (including readonly arrays) than
 * the default Array.isArray.
 */
export function isArray<T extends unknown[] | readonly unknown[]>(value: unknown | T): value is T {
  return Array.isArray(value);
}

export function* times(count: number) {
  for (let i = 0; i < count; i++) {
    yield i;
  }
}

/**
 * Returns an array of numbers from `start` up to `end` (inclusive)
 */
export function* range(start: number, end: number): IterableIterator<number> {
  for (let i = start; i <= end; i++) {
    yield i;
  }
}

export function* reverse<T>(input: T[]): IterableIterator<T> {
  for (let i = input.length - 1; i >= 0; i--) {
    yield input[i]!;
  }
}

export function enumerate<const T extends unknown[] | readonly unknown[]>(
  input: T
): IterableIterator<
  { [P in keyof T]: P extends `${infer N extends number}` ? [N, T[P]] : [number, T[P]] }[number]
>;
export function enumerate<T>(input: Iterable<T>): IterableIterator<[number, T]>;
export function* enumerate<T>(input: Iterable<T>): IterableIterator<[number, T]> {
  let i = 0;
  for (const item of input) {
    yield [i++, item];
  }
}

export function* enumerateReverse<T>(input: readonly T[]): IterableIterator<[number, T]> {
  for (let i = input.length - 1; i >= 0; i--) {
    yield [i, input[i]!];
  }
}

export function* zip<const T>(
  left: readonly T[],
  right: readonly T[]
): IterableIterator<[T, T] | [T | undefined, T] | [T, T | undefined]> {
  for (const [i, item] of enumerate(left)) {
    yield [item, right[i]];
  }

  const excessStart = left.length;

  for (const item of right.slice(excessStart)) {
    yield [undefined, item];
  }
}
