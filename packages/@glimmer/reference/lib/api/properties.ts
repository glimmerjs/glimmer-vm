import type { Reactive, ReactiveResult, RETURN_TYPE } from '@glimmer/interfaces';
import { getProperty, setProperty } from '@glimmer/global-context';
import {
  Err,
  isDict,
  isIndexable,
  isObject,
  mapDevmode,
  Ok,
  setDescription,
  UserException,
} from '@glimmer/util';
import { consumeTag, dirtyTagFor, tagFor } from '@glimmer/validator';

import type { InternalReactive } from './internal/reactive';

import { Accessor } from './accessor';
import { DeeplyReadonlyCell } from './cell';
import { unwrapReactive } from './core';
import { getChildLabel } from './internal/debug';
import { Poison } from './internal/errors';
import { readInternalReactive } from './internal/operations';
import { DEEPLY_CONSTANT, REFERENCE } from './internal/reactive';

export function getReactivePath(reactive: Reactive, path: string[]): Reactive {
  let current: Reactive = reactive;

  for (const part of path) {
    current = getReactiveProperty(current, part);
  }

  return current;
}

export function getReactiveProperty(parentReactive: Reactive, property: PropertyKey): Reactive {
  const type = parentReactive[REFERENCE];

  const children = initializeChildren(parentReactive);

  {
    const child = children.get(property);

    if (child !== undefined) {
      return child as RETURN_TYPE;
    }
  }

  const initialize = (child: Reactive): Reactive => {
    children.set(property, child);

    setDescription(
      child,
      mapDevmode(
        () => parentReactive.description,
        (desc) => {
          return {
            type: 'GetProperty',
            read: 'fallible',
            write: 'fallible',
            label: [...desc.label, property as string | symbol],
          };
        }
      )
    );

    return child as RETURN_TYPE;
  };

  if (type === DEEPLY_CONSTANT) {
    // We need an extra try/catch here because any reactive value can be turned into a deeply
    // constant value.
    try {
      const parent = readInternalReactive(parentReactive as InternalReactive);

      if (parent.type === 'err') {
        return initialize(Poison(parent.value));
      } else {
        if (isDict(parent.value)) {
          return initialize(
            DeeplyReadonlyCell(parent.value[property as keyof typeof parent.value])
          );
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
      const parentResult = readInternalReactive(parentReactive as InternalReactive);

      if (parentResult.type === 'err') {
        return parentResult;
      } else {
        const parent = parentResult.value;

        if (isIndexable(parent)) {
          try {
            setProperty(parent, property as keyof typeof parent, value);

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

  return initialize(child);
}
export function initializeChildren(parent: Reactive) {
  let children = parent.properties;

  if (children === null) {
    children = parent.properties = new Map();
  }

  return children;
}
