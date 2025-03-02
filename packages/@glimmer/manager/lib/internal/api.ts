import type {
  Helper,
  InternalComponentManager,
  InternalModifierManager,
  Owner,
} from '@glimmer/interfaces';
import { debugToString } from '@glimmer/debug-util';
import { debugAssert } from '@glimmer/global-context';

import { CustomHelperManager } from '../public/helper';
import { FunctionHelperManager } from './defaults';

type InternalManager =
  | InternalComponentManager
  | InternalModifierManager
  | CustomHelperManager
  | Helper;

const COMPONENT_MANAGERS = new WeakMap<object, InternalComponentManager>();

const MODIFIER_MANAGERS = new WeakMap<object, InternalModifierManager>();

const HELPER_MANAGERS = new WeakMap<object, CustomHelperManager | Helper>();

///////////

/**
 * There is also Reflect.getPrototypeOf,
 * which errors when non-objects are passed.
 *
 * Since our conditional for figuring out whether to render primitives or not
 * may contain non-object values, we don't want to throw errors when we call this.
 */
const getPrototypeOf = Object.getPrototypeOf;

function setManager<Def extends object>(
  map: WeakMap<object, object>,
  manager: object,
  obj: Def
): Def {
  if (import.meta.env.DEV) {
    debugAssert(
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- JS-only check
      obj !== null && (typeof obj === 'object' || typeof obj === 'function'),
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
      `Attempted to set a manager on a non-object value. Managers can only be associated with objects or functions. Value was ${debugToString!(
        obj
      )}`
    );

    debugAssert(
      !map.has(obj), // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
      `Attempted to set the same type of manager multiple times on a value. You can only associate one manager of each type with a given value. Value was ${debugToString!(
        obj
      )}`
    );
  }

  map.set(obj, manager);
  return obj;
}

function getManager<M extends InternalManager>(
  map: WeakMap<object, M>,
  obj: object
): M | undefined {
  let pointer: object | null = obj;
  while (pointer !== null) {
    const manager = map.get(pointer);

    if (manager !== undefined) {
      return manager;
    }

    pointer = getPrototypeOf(pointer) as object | null;
  }

  return undefined;
}

///////////

export function setInternalModifierManager<T extends object>(
  manager: InternalModifierManager,
  definition: T
): T {
  return setManager(MODIFIER_MANAGERS, manager, definition);
}

export function getInternalModifierManager(definition: object): InternalModifierManager;
export function getInternalModifierManager(
  definition: object,
  isOptional: true | undefined
): InternalModifierManager | null;
export function getInternalModifierManager(
  definition: object,
  isOptional?: true
): InternalModifierManager | null {
  if (import.meta.env.DEV) {
    debugAssert(
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- JS-only check
      (typeof definition === 'object' && definition !== null) || typeof definition === 'function',
      () =>
        // eslint-disable-next-line @typescript-eslint/no-base-to-string -- @fixme
        `Attempted to use a value as a modifier, but it was not an object or function. Modifier definitions must be objects or functions with an associated modifier manager. The value was: ${definition}`
    );
  }

  const manager = getManager(MODIFIER_MANAGERS, definition);

  if (manager === undefined) {
    if (import.meta.env.DEV) {
      debugAssert(
        isOptional,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
        `Attempted to load a modifier, but there wasn't a modifier manager associated with the definition. The definition was: ${debugToString!(
          definition
        )}`
      );
    }

    return null;
  }

  return manager;
}

export function setInternalHelperManager<T extends object, O extends Owner>(
  manager: CustomHelperManager<O> | Helper<O>,
  definition: T
): T {
  return setManager(HELPER_MANAGERS, manager, definition);
}

const DEFAULT_MANAGER = new CustomHelperManager(() => new FunctionHelperManager());

export function getInternalHelperManager(definition: object): CustomHelperManager | Helper;
export function getInternalHelperManager(
  definition: object,
  isOptional: true | undefined
): CustomHelperManager | Helper | null;
export function getInternalHelperManager(
  definition: object,
  isOptional?: true
): CustomHelperManager | Helper | null {
  debugAssert(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- JS-only check
    (typeof definition === 'object' && definition !== null) || typeof definition === 'function',
    () =>
      // eslint-disable-next-line @typescript-eslint/no-base-to-string -- @fixme
      `Attempted to use a value as a helper, but it was not an object or function. Helper definitions must be objects or functions with an associated helper manager. The value was: ${definition}`
  );

  let manager = getManager(HELPER_MANAGERS, definition);

  // Functions are special-cased because functions are defined
  // as the "default" helper, per: https://github.com/emberjs/rfcs/pull/756
  if (manager === undefined && typeof definition === 'function') {
    manager = DEFAULT_MANAGER;
  }

  if (manager) {
    return manager;
  } else if (isOptional === true) {
    return null;
  } else if (import.meta.env.DEV) {
    throw new Error(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
      `Attempted to load a helper, but there wasn't a helper manager associated with the definition. The definition was: ${debugToString!(
        definition
      )}`
    );
  }

  return null;
}

export function setInternalComponentManager<T extends object>(
  factory: InternalComponentManager,
  obj: T
): T {
  return setManager(COMPONENT_MANAGERS, factory, obj);
}

export function getInternalComponentManager(definition: object): InternalComponentManager;
export function getInternalComponentManager(
  definition: object,
  isOptional: true | undefined
): InternalComponentManager | null;
export function getInternalComponentManager(
  definition: object,
  isOptional?: true
): InternalComponentManager | null {
  debugAssert(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- JS-only check
    (typeof definition === 'object' && definition !== null) || typeof definition === 'function',
    () =>
      // eslint-disable-next-line @typescript-eslint/no-base-to-string -- @fixme
      `Attempted to use a value as a component, but it was not an object or function. Component definitions must be objects or functions with an associated component manager. The value was: ${definition}`
  );

  const manager = getManager(COMPONENT_MANAGERS, definition);

  if (manager === undefined) {
    debugAssert(
      isOptional,
      () =>
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
        `Attempted to load a component, but there wasn't a component manager associated with the definition. The definition was: ${debugToString!(
          definition
        )}`
    );

    return null;
  }

  return manager;
}

///////////

export function hasInternalComponentManager(definition: object): boolean {
  return (
    hasDefaultComponentManager(definition) ||
    getManager(COMPONENT_MANAGERS, definition) !== undefined
  );
}

export function hasInternalHelperManager(definition: object): boolean {
  return (
    hasDefaultHelperManager(definition) || getManager(HELPER_MANAGERS, definition) !== undefined
  );
}

export function hasInternalModifierManager(definition: object): boolean {
  return (
    hasDefaultModifierManager(definition) || getManager(MODIFIER_MANAGERS, definition) !== undefined
  );
}

function hasDefaultComponentManager(_definition: object): boolean {
  return false;
}

function hasDefaultHelperManager(definition: object): boolean {
  return typeof definition === 'function';
}

function hasDefaultModifierManager(_definition: object): boolean {
  return false;
}
