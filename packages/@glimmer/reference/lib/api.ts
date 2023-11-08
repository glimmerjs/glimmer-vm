import type {
  FallibleReactiveFormula,
  MutableReactiveCell,
  ReactiveCell,
  ReactiveResult,
  SomeReactive,
} from '@glimmer/interfaces';
import type { Reactive, RETURN_TYPE } from './reference';

import { getProperty, setProperty } from '@glimmer/global-context';
import {
  devmode,
  Err,
  expect,
  isDict,
  isObject,
  mapDevmode,
  Ok,
  setDescription,
  toDescription,
  unwrapResult,
  UserException,
} from '@glimmer/util';
import { consumeTag, dirtyTagFor, tagFor } from '@glimmer/validator';

import { Accessor, ResultAccessor } from './api/accessor';
import { createPrimitiveCell } from './api/cell';
import { FallibleFormula } from './api/formula';
import {
  DEEPLY_CONSTANT,
  DeeplyConstant,
  getChildLabel,
  Poison,
  readInternalReactive,
  READONLY_CELL,
  REFERENCE,
  updateInternalReactive,
} from './reference';

export * from './api/accessor';
export * from './api/cell';
export * from './api/formula';

export function readReactive<T>(reactive: SomeReactive<T>): ReactiveResult<T> {
  return readInternalReactive(reactive as Reactive<T>);
}
export type Primitive = string | number | boolean | null | undefined | bigint | symbol;

function initializeChildren(parent: SomeReactive) {
  let children = parent.properties;

  if (children === null) {
    children = parent.properties = new Map();
  }

  return children;
}

export function toReadonly<T>(reactive: SomeReactive<T>): FallibleReactiveFormula<T> {
  return FallibleFormula(() => unwrapReactive(reactive));
}

export function toMut<T>(maybeMut: SomeReactive<T>): SomeReactive<T> {
  const reactive = maybeMut as Reactive;

  return ResultAccessor({
    get: () => readInternalReactive(maybeMut as Reactive<T>),
    set: (value: unknown) => updateInternalReactive(reactive, value),
  });
}

export function getReactivePath(reactive: SomeReactive, path: string[]): SomeReactive {
  let current: SomeReactive = reactive;

  for (const part of path) {
    current = getReactiveProperty(current, part);
  }

  return current;
}
const PROPERTY_DEFAULTS = devmode(() => ({
  readonly: false,
  fallible: true,
  kind: 'property',
  label: [`(property)`],
}));

export function getReactiveProperty(
  parentReactive: SomeReactive,
  property: PropertyKey
): SomeReactive {
  const type = parentReactive[REFERENCE];

  const children = initializeChildren(parentReactive);

  {
    const child = children.get(property);

    if (child !== undefined) {
      return child as RETURN_TYPE;
    }
  }

  const initialize = (child: SomeReactive): SomeReactive => {
    children.set(property, child);
    return child as RETURN_TYPE;
  };

  if (type === DEEPLY_CONSTANT) {
    // We need an extra try/catch here because any reactive value can be turned into a deeply
    // constant value.
    try {
      const parent = readInternalReactive(parentReactive as Reactive);

      if (parent.type === 'err') {
        return initialize(Poison(parent.value));
      } else {
        if (isDict(parent.value)) {
          return initialize(DeeplyConstant(parent.value[property as keyof typeof parent.value]));
        }
      }
    } catch (e) {
      return initialize(
        Poison(
          UserException.from(
            e,
            `An error occured when getting a property from a deeply constant reactive (${getChildLabel(
              parentReactive,
              property
            )})`
          )
        )
      );
    }
  }

  const child = Accessor({
    get: () => {
      const parent = unwrapReactive(parentReactive);
      if (isDict(parent)) {
        if (isObject(parent)) consumeTag(tagFor(parent, property as keyof typeof parent));

        return getProperty(parent, property as keyof typeof parent);
      }
    },
    set: (value: unknown): ReactiveResult<void> => {
      const parentResult = readInternalReactive(parentReactive as Reactive);

      if (parentResult.type === 'err') {
        return parentResult;
      } else {
        if (isDict(parentResult.value)) {
          try {
            setProperty(parentResult.value, property as any, value);

            if (isObject(parentResult.value))
              dirtyTagFor(parentResult.value, property as keyof typeof parentResult.value);
          } catch (e) {
            return Err(
              UserException.from(
                e,
                `An error occured when setting a property on a deeply constant reactive (${getChildLabel(
                  parentReactive,
                  property
                )})`
              )
            );
          }
        }

        return Ok(undefined);
      }
    },
  });

  setDescription(
    child,
    mapDevmode(
      () => parentReactive.description,
      (desc) => {
        return toDescription([...desc.label, property as string | symbol], PROPERTY_DEFAULTS);
      }
    )
  );

  return initialize(child);
}

export const UNDEFINED_REFERENCE = createPrimitiveCell(undefined);
export const NULL_REFERENCE = createPrimitiveCell(null);
export const TRUE_REFERENCE = createPrimitiveCell(true);
export const FALSE_REFERENCE = createPrimitiveCell(false);

export function isConstant(reactive: SomeReactive) {
  switch (reactive[REFERENCE]) {
    case READONLY_CELL:
    case DEEPLY_CONSTANT:
      return true;
    default:
      return false;
  }
}
export function readCell<T>(reactive: ReactiveCell<T>): T {
  return unwrapReactive(reactive);
}

export function writeCell<T>(reactive: MutableReactiveCell<T>, value: T): void {
  updateReactive(reactive, value);
}
/**
 * This is generally not what you want, as it rethrows errors. It's useful in testing and console
 * situations, and as a transitional mechanism away from valueForRef.
 */

export function unwrapReactive<T>(reactive: SomeReactive<T>): T {
  return unwrapResult(readInternalReactive(reactive as Reactive<T>));
}
export function updateReactive(_ref: SomeReactive, value: unknown) {
  const ref = _ref as Reactive;

  const update = expect(ref.update, 'called update on a non-updatable reference');

  update(value);
}

export function clearError(reactive: SomeReactive) {
  const internal = reactive as Reactive;

  internal.error = null;

  // clearing the tag will cause the reference to be invalidated.
  internal.tag = null;

  internal.lastValue = null;
}
