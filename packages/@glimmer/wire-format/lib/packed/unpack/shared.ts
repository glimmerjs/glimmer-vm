import { Null } from '../expr';

export interface Scope {
  symbols: string[];
  upvars: string[];
}

export function combine<T, U>(
  left: T | null | undefined | Null,
  right: U | null | undefined | Null
): [] | [T] | [U] | [T, U] {
  if (isPresent(left)) {
    return isPresent(right) ? [left, right] : [left];
  } else {
    return isPresent(right) ? [right] : [];
  }
}

export function combineSpread<T, U>(
  left: T | null | undefined,
  right: U[] | null | undefined
): [] | [T] | [...U[]] | [T, ...U[]] {
  if (left === null || left === undefined) {
    return right === null || right === undefined ? [] : right;
  } else {
    return right === null || right === undefined ? [left] : [left, ...right];
  }
}

function isPresent<T>(value: T | null | undefined | Null): value is T {
  return value !== null && value !== undefined && value !== Null;
}
