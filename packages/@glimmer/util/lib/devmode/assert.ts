// import Logger from './logger';

import type { DevMode as DevModeInterface, DevModeClass, Present } from '@glimmer/interfaces';

import type { AnyFunction } from '../types';

import { LOCAL_LOGGER } from './logging';

export function unwrap<T>(value: T): Present<T> {
  assert(value !== null && value !== undefined, 'expected value to be present');
  return value as Present<T>;
}

export function expect<T>(value: T, message: string): Present<T> {
  assert(value !== null && value !== undefined, message);
  return value as Present<T>;
}

export function assert(condition: unknown, msg: string): asserts condition {
  if (import.meta.env.DEV) {
    if (!condition) {
      throw new Error(msg || 'assertion failure');
    }
  }
}

export function deprecate(desc: string) {
  LOCAL_LOGGER.warn(`DEPRECATION: ${desc}`);
}

export default assert;

let DevMode: typeof DevModeClass | undefined;

if (import.meta.env.DEV) {
  DevMode = class DevMode<T> {
    static value<T>(devmode: DevModeInterface<T>) {
      expect(devmode, `Expected value to be present in development mode`);

      return (devmode as unknown as DevMode<T>).#value;
    }

    #value: T;

    constructor(val: T) {
      assert(val !== undefined, `You cannot put undefined in a DevMode`);
      this.#value = val;
    }

    /**
     * Even though eslint will still yell at us, let's get `String(DevMode<string>)` to produce the
     * underlying string.
     */
    toString(): string {
      return String(this.#value);
    }
  } as unknown as typeof DevModeClass;
}

export type IntoDevMode<T> = T | DevModeInterface<T>;

/**
 * This function returns a `DevModeInterface`. It takes an arrow function to ensure that the
 * expression is stripped in production.
 */
export function devmode<const T>(value: () => IntoDevMode<T>): DevModeInterface<T> {
  if (import.meta.env.DEV) {
    return intoDevMode(value());
  }

  return undefined as unknown as DevModeInterface<T>;
}

/**
 * This function is useful if the value in question is a function and the prod-mode version of the
 * function can be successfully inlined.
 *
 * The constraint `Prod extends Dev` allows `Prod` to have fewer arguments than `Dev`, but only at
 * the end.
 */
export function enhancedDevmode<const Dev extends AnyFunction, const Prod extends Dev>(
  prod: Prod,
  dev: Dev
): Dev {
  if (import.meta.env.DEV) {
    return dev;
  } else {
    return prod;
  }
}

function intoDevMode<T>(devmodeValue: IntoDevMode<T>): DevModeInterface<T> {
  return devmodeValue instanceof DevMode!
    ? (devmodeValue as unknown as DevModeInterface<T>)
    : new DevMode!(devmodeValue);
}

/**
 * The first parameter is an arrow so an expression that pulls out a devmode value is always removed
 * outside of dev mode.
 */
export function mapDevmode<const T, const U = T>(
  value: () => DevModeInterface<T>,
  map: (value: T) => IntoDevMode<U>
): DevModeInterface<U> {
  if (import.meta.env.DEV) {
    const devmodeValue = inDevmode(value());

    const innerValue =
      devmodeValue instanceof DevMode! ? DevMode!.value(devmodeValue) : devmodeValue;

    return intoDevMode(map(innerValue));
  }

  return undefined as unknown as DevModeInterface<U>;
}

/**
 * The first parameter is an arrow so an expression that pulls out a devmode value is always removed
 * outside of dev mode.
 */
export function devmodeOr<const T>(value: () => DevModeInterface<T>, inProd: T): T {
  if (import.meta.env.DEV) {
    return inDevmode(value());
  } else {
    return inProd;
  }
}

/**
 * A version of unwrap that is meant to be used in development mode (inside an `import.meta.env.DEV`
 * guard).
 */
export function inDevmode<T>(devmode: DevModeInterface<T>): T {
  if (import.meta.env.DEV) {
    assert(DevMode, `Expected the DevMode class to be present in development mode`);
    assert(
      devmode && devmode instanceof DevMode,
      `Expected value to be present in development mode`
    );
    return DevMode.value(devmode);
  } else {
    throw Error(
      `You shouldn't use devmode values in production mode. This function should even be present in production mode (it should be stripped due to lack of use), so something is wrong.`
    );
  }
}
