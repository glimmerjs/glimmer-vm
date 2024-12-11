// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyKey = keyof any;
export type Indexable = Record<AnyKey, unknown>;

function indexable<T extends object>(input: T): T & Indexable {
  return input as T & Indexable;
}

export function getGlobal(): Indexable {
  if (typeof globalThis !== 'undefined') return indexable(globalThis);
  if (typeof self !== 'undefined') return indexable(self);
  if (typeof window !== 'undefined') return indexable(window);
  if (typeof global !== 'undefined') return indexable(global);

  throw new Error('unable to locate global object');
}

export function unwrap<T>(val: T | null | undefined): T {
  if (val === null || val === undefined) throw new Error(`Expected value to be present`);
  return val as T;
}
