import type {
  Arguments,
  CapturedArguments,
  CapturedNamedArguments,
  CapturedPositionalArguments,
} from '@glimmer/interfaces';
import { valueForRef } from '@glimmer/reference';
import { type Tag, track } from '@glimmer/validator';

const CUSTOM_TAG_FOR = new WeakMap<object, (object: object, key: string) => Tag>();

export function getCustomTagFor(
  object: object
): ((object: object, key: string) => Tag) | undefined {
  return CUSTOM_TAG_FOR.get(object);
}

export function setCustomTagFor(object: object, customTagFn: (object: object, key: string) => Tag) {
  CUSTOM_TAG_FOR.set(object, customTagFn);
}

function convertToInt(property: number | string | symbol): number | null {
  if (typeof property === 'symbol') return null;

  let number_ = Number(property);

  if (Number.isNaN(number_)) return null;

  return number_ % 1 === 0 ? number_ : null;
}

function tagForNamedArgument(namedArgs: CapturedNamedArguments, key: string): Tag {
  return track(() => {
    if (key in namedArgs) {
      valueForRef(namedArgs[key]!);
    }
  });
}

function tagForPositionalArgument(positionalArgs: CapturedPositionalArguments, key: string): Tag {
  return track(() => {
    if (key === '[]') {
      // consume all of the tags in the positional array
      for (let argument of positionalArgs) {
        valueForRef(argument);
      }
    }

    let parsed = convertToInt(key);

    if (parsed !== null && parsed < positionalArgs.length) {
      // consume the tag of the referenced index
      valueForRef(positionalArgs[parsed]!);
    }
  });
}

class NamedArgsProxy implements ProxyHandler<{}> {
  declare set?: (target: {}, property: string | number | symbol) => boolean;

  readonly #named: CapturedNamedArguments;

  constructor(named: CapturedNamedArguments) {
    this.#named = named;
  }

  get(_target: {}, property: string | number | symbol) {
    let reference = this.#named[property as string];

    if (reference !== undefined) {
      return valueForRef(reference);
    }
  }

  has(_target: {}, property: string | number | symbol) {
    return property in this.#named;
  }

  ownKeys() {
    return Object.keys(this.#named);
  }

  isExtensible() {
    return false;
  }

  getOwnPropertyDescriptor(_target: {}, property: string | number | symbol) {
    if (import.meta.env.DEV && !(property in this.#named)) {
      throw new Error(
        `args proxies do not have real property descriptors, so you should never need to call getOwnPropertyDescriptor yourself. This code exists for enumerability, such as in for-in loops and Object.keys(). Attempted to get the descriptor for \`${String(
          property
        )}\``
      );
    }

    return {
      enumerable: true,
      configurable: true,
    };
  }
}

class PositionalArgsProxy implements ProxyHandler<[]> {
  declare set?: (target: [], property: string | number | symbol) => boolean;
  declare ownKeys?: (target: []) => string[];
  #positional: CapturedPositionalArguments;

  constructor(positional: CapturedPositionalArguments) {
    this.#positional = positional;
  }

  get(target: [], property: string | number | symbol) {
    let positional = this.#positional;

    if (property === 'length') {
      return positional.length;
    }

    let parsed = convertToInt(property);

    if (parsed !== null && parsed < positional.length) {
      return valueForRef(positional[parsed]!);
    }

    return (target as any)[property];
  }

  isExtensible() {
    return false;
  }

  has(_target: [], property: string | number | symbol) {
    let parsed = convertToInt(property);

    return parsed !== null && parsed < this.#positional.length;
  }
}

export const argsProxyFor = (
  capturedArgs: CapturedArguments,
  type: 'component' | 'helper' | 'modifier'
): Arguments => {
  let { named, positional } = capturedArgs;

  let getNamedTag = (_: object, key: string) => tagForNamedArgument(named, key);
  let getPositionalTag = (_: object, key: string) => tagForPositionalArgument(positional, key);

  let namedHandler = new NamedArgsProxy(named);
  let positionalHandler = new PositionalArgsProxy(positional);

  let namedTarget = Object.create(null);
  let positionalTarget: unknown[] = [];

  if (import.meta.env.DEV) {
    let setHandler = function (_target: unknown, property: symbol | string | number): never {
      throw new Error(
        `You attempted to set ${String(
          property
        )} on the arguments of a component, helper, or modifier. Arguments are immutable and cannot be updated directly; they always represent the values that are passed down. If you want to set default values, you should use a getter and local tracked state instead.`
      );
    };

    let forInDebugHandler = (): never => {
      throw new Error(
        `Object.keys() was called on the positional arguments array for a ${type}, which is not supported. This function is a low-level function that should not need to be called for positional argument arrays. You may be attempting to iterate over the array using for...in instead of for...of.`
      );
    };

    namedHandler.set = setHandler;
    positionalHandler.set = setHandler;
    positionalHandler.ownKeys = forInDebugHandler;
  }

  let namedProxy = new Proxy(namedTarget, namedHandler);
  let positionalProxy = new Proxy(positionalTarget, positionalHandler);

  setCustomTagFor(namedProxy, getNamedTag);
  setCustomTagFor(positionalProxy, getPositionalTag);

  return {
    named: namedProxy,
    positional: positionalProxy,
  };
};
