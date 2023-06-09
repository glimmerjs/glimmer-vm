import type { DebugName } from '@glimmer/interfaces';
import { dirtyTag } from '..';
import { dirtyTagFor, tagFor } from './meta';
import { consumeTag } from './tracking';
import { createTag } from './validators';

export type Getter<T, K extends keyof T> = (self: T) => T[K] | undefined;
export type Setter<T, K extends keyof T> = (self: T, value: T[K]) => void;

export type TrackedCell<T> = [get: () => T, set: (value: T) => void];

export function trackedCell<T>(value: T, debug?: DebugName): TrackedCell<T> {
  let tag = createTag(debug);
  let get = () => {
    consumeTag(tag);
    return value;
  };

  let set = (newValue: T): void => {
    dirtyTag(tag);
    value = newValue;
  };

  return [get, set];
}

export type TrackedData<T extends object, K extends keyof T> = {
  getter: Getter<T, K>;
  setter: Setter<T, K>;
};

export function trackedData<T extends object, K extends keyof T>(
  key: K,
  initializer?: (this: T) => T[K]
): TrackedData<T, K> {
  let values = new WeakMap<T, T[K]>();
  let hasInitializer = typeof initializer === 'function';

  function getter(self: T) {
    consumeTag(tagFor(self, key));

    let value;

    // If the field has never been initialized, we should initialize it
    if (hasInitializer && !values.has(self)) {
      value = initializer!.call(self);
      values.set(self, value);
    } else {
      value = values.get(self);
    }

    return value;
  }

  function setter(self: T, value: T[K]): void {
    dirtyTagFor(self, key);
    values.set(self, value);
  }

  return { getter, setter };
}
