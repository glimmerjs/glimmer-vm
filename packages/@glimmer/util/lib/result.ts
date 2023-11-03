import type { Result } from '@glimmer/interfaces';

export function Ok<const T>(value: T): Result<T, never> {
  return { type: 'ok', value };
}

export function Err<E>(value: E): Result<never, E> {
  return { type: 'err', value };
}

export function Results<const T extends readonly Result<unknown>[]>(
  results: T
): Result<Results<T>> {
  const values = [];

  for (const result of results) {
    if (result.type === 'err') {
      return result;
    }

    values.push(result.value);
  }

  return { type: 'ok', value: values as Results<T> };
}

export function chainResult<T, U>(value: Result<T>, mapper: (value: T) => Result<U>): Result<U> {
  return value.type === 'ok' ? mapper(value.value) : value;
}

export function flattenResult<T>(value: Result<Result<T>>): Result<T> {
  return value.type === 'ok' ? value.value : value;
}

export function mapResult<T, E, U>(value: Result<T, E>, mapper: (value: T) => U): Result<U, E> {
  if (value.type === 'ok') {
    return { type: 'ok', value: mapper(value.value) };
  } else {
    return value;
  }
}

// @audit almost all uses of these outside of tests aren't correct
export function unwrapResult<T>(value: Result<T>): T {
  switch (value.type) {
    case 'err':
      throw value.value;
    case 'ok':
      return value.value;
  }
}

type Results<T extends readonly Result<unknown>[]> = {
  [P in keyof T]: T[P] extends Result<infer U> ? U : never;
};
