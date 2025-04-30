class TrackedObjectImplementation<T extends object> {
  static fromEntries<T = unknown>(entries: Iterable<readonly [PropertyKey, T]>) {
    return new TrackedObject(Object.fromEntries(entries));
  }

  constructor(...args: Record<PropertyKey, never> extends T ? [] | [T] : [T]);
  constructor(obj = {}) {
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
        getValue(self.#collection);

        return Reflect.ownKeys(target);
      },

      set(target, prop, value) {
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
        return TrackedObjectImplementation.prototype;
      },
    });
  }

  #storages = new Map();

  #collection = createStorage(null, () => false);

  #readStorageFor(key: PropertyKey) {
    let storage = this.#storages.get(key);

    if (storage === undefined) {
      storage = createStorage(null, () => false);
      this.#storages.set(key, storage);
    }

    getValue(storage);
  }

  #dirtyStorageFor(key: PropertyKey) {
    const storage = this.#storages.get(key);

    if (storage) {
      setValue(storage, null);
    }
  }

  #dirtyCollection() {
    setValue(this.#collection, null);
  }
}

interface TrackedObject {
  fromEntries<T = unknown>(
    entries: Iterable<readonly [PropertyKey, T]>
  ): {
    [k: string]: T;
  };

  new <T extends Record<PropertyKey, unknown>>(
    ...args: Record<PropertyKey, never> extends T ? [] | [T] : [T]
  ): T;
}

const TrackedObject: TrackedObject = TrackedObjectImplementation as unknown as TrackedObject;

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
