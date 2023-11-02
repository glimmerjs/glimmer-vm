import type { Result } from '@glimmer/interfaces';

export function Ok<const T>(value: T): Result<T> {
  return { type: 'ok', value };
}

export function Err(value: unknown): Result<never> {
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

export function mapResult<T, U>(value: Result<T>, mapper: (value: T) => U): Result<U> {
  if (value.type === 'ok') {
    return { type: 'ok', value: mapper(value.value) };
  } else {
    return value;
  }
}

type Results<T extends readonly Result<unknown>[]> = {
  [P in keyof T]: T[P] extends Result<infer U> ? U : never;
};
