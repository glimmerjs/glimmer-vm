// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyKey = keyof any;
export type Indexable = Record<AnyKey, unknown>;

function indexable<T extends object>(input: T): T & Indexable {
  return input as T & Indexable;
}

export function getGlobal(): Indexable {
  return indexable(globalThis);
}

export function unwrap<T>(val: T | null | undefined): T {
  if (val === null || val === undefined) throw new Error(`Expected value to be present`);
  return val as T;
}
