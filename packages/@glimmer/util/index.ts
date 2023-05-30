export * from './lib/array-utils';
export { assert, deprecate } from './lib/assert';
export {
  dict,
  isDict,
  isObject,
  StackImpl as Stack,
  PresentStackImpl as PresentStack,
} from './lib/collections';
export { beginTestSteps, endTestSteps, logStep, verifySteps } from './lib/debug-steps';
export { default as debugToString } from './lib/debug-to-string';
export * from './lib/dom';
export * from './lib/dom-utils';
export * from './lib/immediate';
export { default as intern } from './lib/intern';
export {
  isSerializationFirstNode,
  SERIALIZATION_FIRST_NODE_STRING,
} from './lib/is-serialization-first-node';
export { type ObjectEntry, assign, entries, values } from './lib/object-utils';
export * from './lib/platform-utils';
export * from './lib/present';
export {
  castToBrowser,
  castToSimple,
  checkBrowserNode as checkNode,
  isElement,
  isSimpleElement,
} from './lib/simple-cast';
export * from './lib/string';
export * from './lib/template';
export { default as buildUntouchableThis } from './lib/untouchable-this';

export type FIXME<T, S extends string> = (T & S) | T;

let INTERNAL_LOGGER = console;

if (import.meta.env.DEV) {
  let IS_INTERNAL_LOG = false;

  INTERNAL_LOGGER = new Proxy(console, {
    get(target, prop) {
      if (prop === 'isInternalLog') {
        return IS_INTERNAL_LOG;
      }

      // eslint-disable-next-line prefer-let/prefer-let
      const maybeMethod = Reflect.getOwnPropertyDescriptor(target, prop);

      return maybeMethod && 'value' in maybeMethod && typeof maybeMethod.value === 'function'
        ? (...args: unknown[]) => {
            try {
              IS_INTERNAL_LOG = true;
              maybeMethod.value.call(this, ...args);
            } finally {
              IS_INTERNAL_LOG = false;
            }
          }
        : maybeMethod;
    },
  });
}

/**
 * This constant exists to make it easier to differentiate normal logs from
 * errant console.logs. LOCAL_LOGGER should only be used inside a
 * LOCAL_SHOULD_LOG check.
 *
 * It does not alleviate the need to check LOCAL_SHOULD_LOG, which is used
 * for stripping.
 */
export const LOCAL_LOGGER: typeof console & { isInternalLog?: boolean } = INTERNAL_LOGGER;

/**
 * This constant exists to make it easier to differentiate normal logs from
 * errant console.logs. LOGGER can be used outside of LOCAL_SHOULD_LOG checks,
 * and is meant to be used in the rare situation where a console.* call is
 * actually appropriate.
 */
export const LOGGER = console;

export function assertNever(value: never, desc = 'unexpected unreachable branch'): never {
  LOGGER.log('unreachable', value);
  LOGGER.log(`${desc} :: ${JSON.stringify(value)} (${value})`);

  throw new Error(`code reached unreachable`);
}
