import type { ArraySlice } from 'type-fest';

export const EMPTY_ARRAY: readonly unknown[] = Object.freeze([]) as readonly unknown[];

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

export function* reverse<T>(input: T[]): IterableIterator<T> {
  for (let i = input.length - 1; i >= 0; i--) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
    yield input[i]!;
  }
}

export function* enumerate<T>(input: Iterable<T>): IterableIterator<[number, T]> {
  let i = 0;
  for (const item of input) {
    yield [i++, item];
  }
}

type ZipEntry<T extends readonly unknown[], U extends readonly unknown[]> = {
  [P in keyof T]: P extends `${infer N extends number}`
    ? P extends keyof U
      ? [N, T[P], U[P]]
      : [N, T[P], undefined]
    : never;
}[keyof T & number];

/**
 * Zip two tuples with the same number of elements.
 */
export function* zipTuples<T extends readonly unknown[], U extends readonly unknown[]>(
  left: T,
  right: U
): IterableIterator<ZipEntry<T, U>> {
  for (let i = 0; i < left.length; i++) {
    yield [i, left[i], right[i]] as ZipEntry<T, U>;
  }
}

export function* zipArrays<T>(
  left: T[],
  right: T[]
): IterableIterator<
  ['retain', number, T, T] | ['pop', number, T, undefined] | ['push', number, undefined, T]
> {
  for (let i = 0; i < left.length; i++) {
    const perform = i < right.length ? 'retain' : 'pop';
    yield [perform, i, left[i], right[i]] as
      | ['retain', number, T, T]
      | ['pop', number, T, undefined];
  }

  for (let i = left.length; i < right.length; i++) {
    yield ['push', i, undefined, right[i]] as ['push', number, undefined, T];
  }
}

export function slice<
  const T extends unknown[],
  const Start extends number,
  const End extends number = never,
>(input: T, start: Start, end?: End): ArraySlice<T, Start, End> {
  if (end === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
    return input.slice(start) as any;
  } else {
    return input.slice(start, end) as ArraySlice<T, Start, End>;
  }
}
