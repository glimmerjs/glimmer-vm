// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyKey = keyof any;
export type Indexable = Record<AnyKey, unknown>;

// eslint-disable-next-line @typescript-eslint/ban-types
export function indexable<T extends object>(input: T): T & Indexable {
  return input as T & Indexable;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const symbolFor: (key: string) => any =
  typeof Symbol !== 'undefined'
    ? Symbol.for
    : (key: string) => `__GLIMMER_VALIDATOR_SYMBOL_FOR_${key}`;

export function getGlobal(): Indexable {
  // eslint-disable-next-line node/no-unsupported-features/es-builtins
  if (typeof globalThis !== 'undefined') return indexable(globalThis);
  if (typeof self !== 'undefined') return indexable(self);
  if (typeof window !== 'undefined') return indexable(window);
  if (typeof global !== 'undefined') return indexable(global);

  throw new Error('unable to locate global object');
}
