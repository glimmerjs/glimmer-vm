import { Option } from '@glimmer/interfaces';

export type PresentArray<T> = [T, ...T[]];

export function isPresent<T>(list: T[]): list is PresentArray<T> {
  return list.length > 0;
}

export function toPresentOption<T>(list: T[]): Option<PresentArray<T>> {
  if (isPresent(list)) {
    return list;
  } else {
    return null;
  }
}

export function assertPresent<T>(list: T[]): PresentArray<T> {
  if (isPresent(list)) {
    return list;
  } else {
    throw new Error(`unexpected empty list`);
  }
}

export function mapPresent<T, U>(list: PresentArray<T>, callback: (input: T) => U): PresentArray<U>;
export function mapPresent<T, U>(
  list: PresentArray<T> | null,
  callback: (input: T) => U
): PresentArray<U> | null;
export function mapPresent<T, U>(
  list: PresentArray<T> | null,
  callback: (input: T) => U
): PresentArray<U> | null {
  if (list === null) {
    return null;
  }
  let out: U[] = [];

  for (let item of list) {
    out.push(callback(item));
  }

  return out as PresentArray<U>;
}
