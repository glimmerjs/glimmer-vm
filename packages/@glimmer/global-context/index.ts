/**
 * This package contains global context functions for Glimmer. These functions
 * are set by the embedding environment and must be set before initial render.
 *
 * These functions should meet the following criteria:
 *
 * - Must be provided by the embedder, due to having framework specific
 *   behaviors (e.g. interop with classic Ember behaviors that should not be
 *   upstreamed) or to being out of scope for the VM (e.g. scheduling a
 *   revalidation)
 * - Never differ between render roots
 * - Never change over time
 *
 */

////////// BASIC INTERFACES //////////

interface IteratorDelegate {
  isEmpty(): boolean;
  next(): { value: unknown; memo: unknown } | null;
}

export type Destroyable = object;
export type Destructor<T extends Destroyable> = (destroyable: T) => void;

//////////

/**
 * These hooks are available before the global context is initialized.
 */
export interface InitialGlobalContext {
  /**
   * Schedules a VM revalidation.
   *
   * Note: this has a default value so that tags can warm themselves when first loaded.
   */
  scheduleRevalidate: () => void;
}

/**
 * These are the basic runtime hooks that are available in both development
 * and production mode.
 */
export interface GlobalContext extends InitialGlobalContext {
  /**
   * Schedules a destructor to run
   *
   * @param destroyable The destroyable being destroyed
   * @param destructor The destructor being scheduled
   */
  scheduleDestroy: <T extends Destroyable>(destroyable: T, destructor: Destructor<T>) => void;

  /**
   * Finalizes destruction
   *
   * @param finalizer finalizer function
   */
  scheduleDestroyed: (finalizer: () => void) => void;

  /**
   * Hook to provide iterators for `{{each}}` loops
   *
   * @param value The value to create an iterator for
   */
  toIterator: (value: unknown) => IteratorDelegate | null;

  /**
   * Hook to specify truthiness within Glimmer templates
   *
   * @todo toBool is only ever used in the context of an
   *   environment, so it should be an environment hook
   *   not a global context hook.
   *
   * @param value The value to convert to a boolean
   */
  toBool: (value: unknown) => boolean;

  /**
   * Hook for specifying how Glimmer should access properties in cases where it
   * needs to. For instance, accessing an object's values in templates.
   *
   * @param obj The object provided to get a value from
   * @param path The path to get the value from
   */
  getProp: (obj: object, path: string) => unknown;

  /**
   * Hook for specifying how Glimmer should update props in cases where it needs
   * to. For instance, when updating a template reference (e.g. 2-way-binding)
   *
   * @param obj The object provided to get a value from
   * @param prop The prop to set the value at
   * @param value The value to set the value to
   */
  setProp: (obj: object, prop: string, value: unknown) => void;

  /**
   * Hook for specifying how Glimmer should access paths in cases where it needs
   * to. For instance, the `key` value of `{{each}}` loops.
   *
   * @param obj The object provided to get a value from
   * @param path The path to get the value from
   */
  getPath: (obj: object, path: string) => unknown;

  /**
   * Hook for specifying how Glimmer should update paths in cases where it needs
   * to. For instance, when updating a template reference (e.g. 2-way-binding)
   *
   * @param obj The object provided to get a value from
   * @param path The path to get the value from
   */
  setPath: (obj: object, prop: string, value: unknown) => void;

  FEATURES?: {
    DEFAULT_HELPER_MANAGER?: boolean;
  };
}

/**
 * These hooks are only available in development mode
 * (when `import.meta.env.DEV` or `@glimmer/env`'s `DEBUG`
 * is true).
 */
export interface DevModeGlobalContext extends GlobalContext {
  /**
   * Hook to warn if a style binding string or value was not marked as trusted
   * (e.g. HTMLSafe)
   *
   * @category dev
   */
  warnIfStyleNotTrusted: (value: unknown) => void;

  /**
   * Hook to customize assertion messages in the VM.
   *
   * @category dev
   */
  assert: (test: unknown, msg: string, options?: { id: string }) => asserts test;

  /**
   * Hook to customize deprecation messages in the VM.
   *
   * @category dev
   */
  deprecate: (
    msg: string,
    test: unknown,
    options: {
      id: string;
    }
  ) => void;
}

/**
 * The global context is set on this symbol in the global object. The first
 * copy of this code that runs will set up the initial global state, and all
 * subsequent copies will use the same global state.
 *
 * This means that `setGlobalContext` will always interact with the same
 * global state, even if the copy of `@glimmer/global-context` that ran
 * first is different from the copy that runs `setGlobalContext`.
 *
 * It also means that `context()` will always return the shared global state,
 * regardless of whether the copy that's running `setGlobalContext` is different.
 *
 * Note that the total amount of code in this package in production mode is
 * very small and that this package is inlined into published packages.
 */
const CONTEXT = Symbol.for('@glimmer/global-context');

/**
 *
 */
interface UninitializedGlobalContext {
  initialized: false;
  mode?: never;
  context: InitialGlobalContext;
}

interface InitializedDevModeGlobalContext {
  initialized: true;
  mode: 'dev';
  context: DevModeGlobalContext;
}

interface InitializedProdModeGlobalContext {
  initialized: true;
  mode?: never;
  context: GlobalContext;
}

type InitializedGlobalContext = InitializedDevModeGlobalContext | InitializedProdModeGlobalContext;

type RegisteredGlobalContext = UninitializedGlobalContext | InitializedGlobalContext;

let globalContextStorage = Reflect.get(globalThis, CONTEXT) as RegisteredGlobalContext;

if (!globalContextStorage) {
  globalContextStorage = {
    initialized: false,
    context: {
      scheduleRevalidate: () => {},
    },
  };

  if (import.meta.env.DEV) {
    const uninitialized = (name: string) => (): never => {
      throw new Error(
        `The global context was not set, and you attempted to access the ${name} function.`
      );
    };

    Object.assign(globalContextStorage.context, {
      assert: uninitialized('assert'),
      deprecate: uninitialized('deprecate'),
      scheduleDestroy: uninitialized('scheduleDestroy'),
      scheduleDestroyed: uninitialized('scheduleDestroyed'),
      getProp: uninitialized('getProp'),
      getPath: uninitialized('getPath'),
      setProp: uninitialized('setProp'),
      setPath: uninitialized('setPath'),
      toBool: uninitialized('toBool'),
      toIterator: uninitialized('toIterator'),
      warnIfStyleNotTrusted: uninitialized('warnIfStyleNotTrusted'),
    } satisfies Omit<DevModeGlobalContext, 'scheduleRevalidate'>);
  }

  Reflect.set(globalThis, CONTEXT, globalContextStorage);
}

const globalContext: RegisteredGlobalContext = globalContextStorage;

export function context(mode: 'dev'): DevModeGlobalContext;
export function context(): GlobalContext;
export function context(_mode?: 'dev'): GlobalContext {
  /**
   * The assertion about missing context functions is implemented as a
   * default implementation of each hook in dev mode. This allows
   * `scheduleRevalidate` to run before initialization. See
   * {@linkcode InitialGlobalContext['scheduleRevalidate']} for more
   * information.
   */

  // This code doesn't stop the user from passing `'dev'` for `mode` in
  // production mode, but since we don't assert in production mode, we
  // just have to live with it.
  //
  // The expected usage pattern is to wrap `context('dev')` calls in an
  // `if (import.meta.env.DEV) { ... }` block. Hopefully mistakes along
  // these lines will be caught by tests.

  return globalContext.context as GlobalContext;
}

export default function setGlobalContext(specified: GlobalContext, mode: 'prod'): void;
export default function setGlobalContext(specified: DevModeGlobalContext, mode: 'dev'): void;
export default function setGlobalContext(specified: DevModeGlobalContext): void;
export default function setGlobalContext(specified: GlobalContext, _mode?: 'dev' | 'prod'): void {
  assert(
    globalContext.initialized === false,
    'The global context was already set. This should only be set once.'
  );

  const current = globalContext as unknown as InitializedGlobalContext;

  current.initialized = true;

  if (import.meta.env.DEV) {
    assert('assert' in specified, 'In dev mode, you must specify a dev mode global context.');
    (current as InitializedDevModeGlobalContext).mode = 'dev';
  }

  globalContext.context = specified;
}

export const assertGlobalContextWasSet = (): void => {
  assert(
    globalContextStorage.initialized === true,
    'The global context for Glimmer VM was not set. You must set these global context functions to let Glimmer VM know how to accomplish certain operations. You can do this by importing `setGlobalContext` from `@glimmer/global-context`'
  );
};

export interface GlobalContextOverride {
  done: () => void;
}

export const testOverrideGlobalContext = (
  overrides: Partial<DevModeGlobalContext>
): GlobalContextOverride => {
  if (import.meta.env.DEV) {
    let originalGlobalContext = {
      initialized: globalContextStorage.initialized,
      context: { ...globalContextStorage.context },
    } as RegisteredGlobalContext;

    globalContextStorage.context = {
      ...globalContextStorage.context,
      ...overrides,
    };

    return {
      done: () => {
        globalContextStorage.context = originalGlobalContext.context;
      },
    };
  }

  unreachable();
};

/**
 * Export this function because attempting to use `asserts` functions indirectly
 * is unergonomic (indirect use of `asserts` functions require explicit type
 * annotations).
 */
export function assert(test: unknown, msg: string, options?: { id: string }): asserts test {
  if (import.meta.env.DEV) {
    if (globalContext.initialized && globalContext.mode === 'dev') {
      const assert: DevModeGlobalContext['assert'] = globalContext.context.assert;
      assert(test, msg, options);
    }

    if (!test) {
      throw new Error(msg);
    }
  }
}

/**
 * Explicitly export this function so that it can be used without `import.meta.env.DEV`
 * checks throughout the codebase, but still be tree-shaken in production.
 */
export function deprecate(
  msg: string,
  test: unknown,
  options: {
    id: string;
  }
): void {
  if (import.meta.env.DEV) {
    context('dev').deprecate(msg, test, options);
  }
}

function unreachable(): never;
function unreachable(): void {
  if (import.meta.env.DEV) {
    throw new Error('Unreachable');
  }
}
