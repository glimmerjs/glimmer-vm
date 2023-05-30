export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

export type AnyKey = keyof any;
export type Indexable = Record<AnyKey, unknown>;

export function indexable<T extends object>(input: T): T & Indexable {
  return input as T & Indexable;
}

export function getGlobal(): Indexable {
  if (typeof globalThis !== 'undefined') return indexable(globalThis);
  if (typeof self !== 'undefined') return indexable(self);
  if (typeof window !== 'undefined') return indexable(window);
  if (typeof global !== 'undefined') return indexable(global);

  throw new Error('unable to locate global object');
}

export function unwrap<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error(`Expected value to be present`);
  return value as T;
}

export function unwrapDebug<T>(value: T | null | undefined): T {
  if (value === null || value === undefined)
    throw new Error(
      `Expected value to be present in debug (when wrapped in a check for import.meta.env.DEV)`
    );
  return value as T;
}
