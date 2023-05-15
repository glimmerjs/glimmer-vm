type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

export type ObjectEntry<D extends object> = Expand<{ [P in keyof D]: [P, D[P]] }[keyof D]>;

export function values<V>(object: Record<string, V>): V[];
export function entries<O extends object>(object: O): ObjectEntry<O>[];
