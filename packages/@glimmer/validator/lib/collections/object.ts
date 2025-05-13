import type { ReactiveOptions } from './types';

import { consumeTag } from '../tracking';
import { createUpdatableTag, DIRTY_TAG } from '../validators';

class TrackedObject<T extends object> {
  #options: ReactiveOptions<unknown>;
  #storages = new Map<PropertyKey, ReturnType<typeof createUpdatableTag>>();
  #collection = createUpdatableTag();

  #readStorageFor(key: PropertyKey) {
    let storage = this.#storages.get(key);

    if (storage === undefined) {
      storage = createUpdatableTag();
      this.#storages.set(key, storage);
    }

    consumeTag(storage);
  }

  #dirtyStorageFor(key: PropertyKey) {
    const storage = this.#storages.get(key);

    if (storage) {
      DIRTY_TAG(storage);
    }
  }

  #dirtyCollection() {
    DIRTY_TAG(this.#collection);
  }

  constructor(obj: T, options: ReactiveOptions<unknown>) {
    this.#options = options;

    const proto = Object.getPrototypeOf(obj);
    const descs = Object.getOwnPropertyDescriptors(obj);
    const clone = Object.create(proto);

    for (const prop in descs) {
      Object.defineProperty(clone, prop, descs[prop]!);
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    return new Proxy(clone, {
      get(target, prop) {
        self.#readStorageFor(prop);

        return target[prop];
      },

      has(target, prop) {
        self.#readStorageFor(prop);

        return prop in target;
      },

      ownKeys(target: T) {
        consumeTag(self.#collection);

        return Reflect.ownKeys(target);
      },

      set(target, prop, value) {
        let isUnchanged = self.#options.equals(target[prop], value);

        if (isUnchanged) {
          return true;
        }

        target[prop] = value;

        self.#dirtyStorageFor(prop);
        self.#dirtyCollection();

        return true;
      },

      deleteProperty(target, prop) {
        if (prop in target) {
          delete target[prop];
          self.#dirtyStorageFor(prop);
          self.#storages.delete(prop);
          self.#dirtyCollection();
        }

        return true;
      },

      getPrototypeOf() {
        return TrackedObject.prototype;
      },
    });
  }
}

export function trackedObject<ObjectType extends object>(
  data?: ObjectType,
  options?: {
    equals?: (a: ObjectType[keyof ObjectType], b: ObjectType[keyof ObjectType]) => boolean;
    description?: string;
  }
): ObjectType {
  return new TrackedObject(data ?? [], {
    equals: options?.equals ?? Object.is,
    description: options?.description,
  });
}
