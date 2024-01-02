export declare class DevModeClass<T> {
  static value<T>(devmode: DevMode<T>): T;

  // make the class nominal;
  // eslint-disable-next-line no-unused-private-class-members
  readonly #value: T;

  constructor(value: T);

  toString(): string;
}

/**
 * DevMode<T> is a value that can be dereferenced in dev mode, and is actually undefined in
 * production mode. However, the only way to actually access the value is via `inDevmode`, which
 * shouldn't exist in production mode (and if it does, it throws an error).
 */
export type DevMode<T> = DevModeClass<T>;
