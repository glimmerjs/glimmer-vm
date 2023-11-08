export type Factory<T> = new (...args: unknown[]) => T;

export function keys<T extends object>(obj: T): Array<keyof T> {
  return Object.keys(obj) as Array<keyof T>;
}

export function unreachable(message?: string): never {
  if (import.meta.env.DEV) {
    throw new Error(message ?? 'unreachable');
  }

  Never();
}

export function exhausted(value: never): never {
  if (import.meta.env.DEV) {
    throw new Error(`Exhausted ${String(value)}`);
  }

  Never();
}

/**
 * https://tiny.katz.zone/EhdPZQ
 */
export function Never(): never {
  return undefined as never;
}
