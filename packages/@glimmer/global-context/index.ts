/**
 * This package contains global context functions for Glimmer. These functions are set by the
 * embedding environment and must be set before initial render.
 *
 * These functions should meet the following criteria:
 *
 * - Must be provided by the embedder, due to having framework specific behaviors (e.g. interop with
 *   classic Ember behaviors that should not be upstreamed) or to being out of scope for the VM
 *   (e.g. scheduling a revalidation)
 * - Never differ between render roots
 * - Never change over time
 *
 */

type Dict<T = unknown> = object & Record<string, T>;

//////////

/**
 * Interfaces
 *
 * TODO: Move these into @glimmer/interfaces, move @glimmer/interfaces to
 * @glimmer/internal-interfaces.
 */
interface IteratorDelegate {
  isEmpty(): boolean;
  next(): { value: unknown; memo: unknown } | null;
}

export type Destroyable = object;
export type Destructor<T extends Destroyable> = (destroyable: T) => void;

//////////

/**
 * Schedules a VM revalidation.
 *
 * Note: this has a default value so that tags can warm themselves when first loaded.
 */
export let scheduleRevalidate: () => void = () => {};

/**
 * Schedules a destructor to run
 *
 * @param destroyable The destroyable being destroyed
 * @param destructor The destructor being scheduled
 */
export let scheduleDestroy: <T extends Destroyable>(
  destroyable: T,
  destructor: Destructor<T>
) => void;

/**
 * Finalizes destruction
 *
 * @param finalizer finalizer function
 */
export let scheduleDestroyed: (finalizer: () => void) => void;

/**
 * Hook to provide iterators for `{{each}}` loops
 *
 * @param value The value to create an iterator for
 */
export let toIterator: (value: unknown) => IteratorDelegate | null;

/**
 * Hook to specify truthiness within Glimmer templates
 *
 * @param value The value to convert to a boolean
 */
export let toBool: (value: unknown) => boolean;

/**
 * Hook for specifying how Glimmer should access properties in cases where it needs to. For
 * instance, accessing an object's values in templates.
 *
 * If you want to support symbol keys, use `getProperty` instead.
 *
 * @param obj The object provided to get a value from
 * @param path The path to get the value from
 */
export let getProp: GlobalContext['getProp'];

const defaultGetProperty: GlobalContext['getProperty'] = (parent, key) => {
  const prop: string | symbol = typeof key === 'number' ? String(key) : key;

  if (typeof prop === 'symbol') {
    return parent[key];
  } else if (getProp) {
    return getProp(parent, prop) as never;
  } else {
    return parent[prop];
  }
};

/**
 * An expanded version of {@linkcode getProp} that supports symbol keys.
 *
 * @param obj The object provided to get a value from
 * @param path The path to get the value from
 */
export let getProperty: GlobalContext['getProperty'] = defaultGetProperty;

/**
 * Hook for specifying how Glimmer should update props in cases where it needs to. For instance,
 * when updating a template reference (e.g. 2-way-binding)
 *
 * @param obj The object provided to get a value from
 * @param prop The prop to set the value at
 * @param value The value to set the value to
 */
export let setProp: GlobalContext['setProp'];

const defaultSetProperty: GlobalContext['setProperty'] = (parent, key, value) => {
  const prop: string | symbol = typeof key === 'number' ? String(key) : key;

  if (typeof prop === 'symbol') {
    parent[key] = value;
  } else if (setProp) {
    setProp(parent, prop, value);
  } else {
    parent[prop] = value;
  }
};

/**
 * An expanded version of {@linkcode setProp} that supports symbol keys.
 *
 * @param obj The object provided to get a value from
 * @param prop The prop to set the value at
 * @param value The value to set the value to
 */
export let setProperty: GlobalContext['setProperty'] = defaultSetProperty;

/**
 * Hook for specifying how Glimmer should access paths in cases where it needs to. For instance, the
 * `key` value of `{{each}}` loops.
 *
 * @param obj The object provided to get a value from
 * @param path The path to get the value from
 */
export let getPath: (obj: object, path: string) => unknown;

/**
 * Hook for specifying how Glimmer should update paths in cases where it needs to. For instance,
 * when updating a template reference (e.g. 2-way-binding)
 *
 * @param obj The object provided to get a value from
 * @param prop The path to get the value from
 * @param value The value to set the value to
 */
export let setPath: (obj: object, path: string, value: unknown) => unknown;

/**
 * Hook to warn if a style binding string or value was not marked as trusted (e.g. HTMLSafe)
 */
export let warnIfStyleNotTrusted: (value: unknown) => void;

/**
 * Hook to customize assertion messages in the VM. Usages can be stripped out by using the
 * @glimmer/vm-babel-plugins package.
 */
export let assert: (test: unknown, msg: string, options?: { id: string }) => asserts test;

/**
 * Hook to customize deprecation messages in the VM. Usages can be stripped out by using the
 * @glimmer/vm-babel-plugins package.
 */
export let deprecate: (
  msg: string,
  test: unknown,
  options: {
    id: string;
  }
) => void;

//////////

export interface GlobalContext {
  scheduleRevalidate: () => void;
  scheduleDestroy: <T extends Destroyable>(destroyable: T, destructor: Destructor<T>) => void;
  scheduleDestroyed: (finalizer: () => void) => void;
  toIterator: (value: unknown) => IteratorDelegate | null;
  toBool: (value: unknown) => boolean;
  getProp: (obj: object, path: string) => unknown;
  /**
   * Optionally set up `getProperty` if you want to be able to support symbol keys
   */
  getProperty: <T extends Dict, K extends keyof T>(parent: T, key: K) => T[K];
  setProp: (obj: object, prop: string, value: unknown) => void;
  /**
   * Optionally set up `setProperty` if you want to be able to support symbol keys
   */
  setProperty: <T extends Dict, K extends keyof T>(parent: T, key: K, value: T[K]) => void;
  getPath: (obj: object, path: string) => unknown;
  setPath: (obj: object, prop: string, value: unknown) => void;
  warnIfStyleNotTrusted: (value: unknown) => void;
  assert: (test: unknown, msg: string, options?: { id: string }) => asserts test;
  deprecate: (
    msg: string,
    test: unknown,
    options: {
      id: string;
    }
  ) => void;
  FEATURES?: {
    DEFAULT_HELPER_MANAGER?: boolean;
  };
}

let globalContextWasSet = false;

export default function setGlobalContext(
  context: Omit<GlobalContext, 'getProperty' | 'setProperty'> &
    Partial<Pick<GlobalContext, 'getProperty' | 'setProperty'>>
): void {
  if (import.meta.env.DEV) {
    if (globalContextWasSet) {
      throw new Error('Attempted to set the global context twice. This should only be set once.');
    }

    globalContextWasSet = true;
  }

  scheduleRevalidate = context.scheduleRevalidate;
  scheduleDestroy = context.scheduleDestroy;
  scheduleDestroyed = context.scheduleDestroyed;
  toIterator = context.toIterator;
  toBool = context.toBool;
  getPath = context.getPath;
  setPath = context.setPath;
  warnIfStyleNotTrusted = context.warnIfStyleNotTrusted;
  assert = context.assert;
  deprecate = context.deprecate;
}

export let assertGlobalContextWasSet: (() => void) | undefined;
export let testOverrideGlobalContext:
  | ((context: Partial<GlobalContext> | null) => GlobalContext | null)
  | undefined;

if (import.meta.env.DEV) {
  assertGlobalContextWasSet = () => {
    if (globalContextWasSet === false) {
      throw new Error(
        'The global context for Glimmer VM was not set. You must set these global context functions to let Glimmer VM know how to accomplish certain operations. You can do this by importing `setGlobalContext` from `@glimmer/global-context`'
      );
    }
  };

  testOverrideGlobalContext = (context: Partial<GlobalContext> | null) => {
    let originalGlobalContext = globalContextWasSet
      ? {
          scheduleRevalidate,
          scheduleDestroy,
          scheduleDestroyed,
          toIterator,
          toBool,
          getProp,
          getProperty,
          setProp,
          setProperty,
          getPath,
          setPath,
          warnIfStyleNotTrusted,
          assert,
          deprecate,
        }
      : null;

    if (context === null) {
      globalContextWasSet = false;
    } else {
      globalContextWasSet = true;
    }

    // We use `undefined as any` here to unset the values when resetting the context at the end of a
    // test.
    scheduleRevalidate = context?.scheduleRevalidate || (undefined as any);
    scheduleDestroy = context?.scheduleDestroy || (undefined as any);
    scheduleDestroyed = context?.scheduleDestroyed || (undefined as any);
    toIterator = context?.toIterator || (undefined as any);
    toBool = context?.toBool || (undefined as any);
    getProperty = context?.getProperty || defaultGetProperty;
    getProp = context?.getProp || (undefined as any);
    setProperty = context?.setProperty || defaultSetProperty;
    setProp = context?.setProp || (undefined as any);
    getPath = context?.getPath || (undefined as any);
    setPath = context?.setPath || (undefined as any);
    warnIfStyleNotTrusted = context?.warnIfStyleNotTrusted || (undefined as any);
    assert = context?.assert || (undefined as any);
    deprecate = context?.deprecate || (undefined as any);

    return originalGlobalContext;
  };
}
