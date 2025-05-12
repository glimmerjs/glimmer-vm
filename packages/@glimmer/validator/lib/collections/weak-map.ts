import { consumeTag } from '../tracking';
import { createUpdatableTag, DIRTY_TAG } from '../validators';

interface ReactiveOptions<Value> {
  equals: (a: Value, b: Value) => boolean;
  description: string | undefined;
}

class TrackedWeakMap<K extends WeakKey = object, V = unknown> implements WeakMap<K, V> {
  #options: ReactiveOptions<V>;
  #storages = new WeakMap<K, ReturnType<typeof createUpdatableTag>>();
  #vals: WeakMap<K, V>;

  #storageFor(key: K): ReturnType<typeof createUpdatableTag> {
    let storage = this.#storages.get(key);

    if (storage === undefined) {
      storage = createUpdatableTag();
      this.#storages.set(key, storage);
    }

    return storage;
  }
  #dirtyStorageFor(key: K): void {
    const storage = this.#storages.get(key);

    if (storage) {
      DIRTY_TAG(storage);
    }
  }

  constructor(iterable: Iterable<readonly [K, V]> | readonly [K, V][] | null, options: ReactiveOptions<V>);
  constructor(
    existing?: readonly [K, V][] | Iterable<readonly [K, V]> | null,
    options: ReactiveOptions<V>
  ) {
    // TypeScript doesn't correctly resolve the overloads for calling the `Map`
    // constructor for the no-value constructor. This resolves that.
    this.#vals = existing ? new WeakMap(existing) : new WeakMap();
    this.#options = options;
  }

  get(key: K): V | undefined {
    consumeTag(this.#storageFor(key));

    return this.#vals.get(key);
  }

  has(key: K): boolean {
    consumeTag(this.#storageFor(key));

    return this.#vals.has(key);
  }

  set(key: K, value: V): this {
    let existing = this.#vals.get(key);

    if (existing) {
      let isUnchanged = this.#options.equals(existing, value);

      if (isUnchanged) {
        return this;
      }
    }

    this.#dirtyStorageFor(key);

    this.#vals.set(key, value);

    return this;
  }

  delete(key: K): boolean {
    this.#dirtyStorageFor(key);

    this.#storages.delete(key);
    return this.#vals.delete(key);
  }

  get [Symbol.toStringTag](): string {
    return this.#vals[Symbol.toStringTag];
  }
}

// So instanceof works
Object.setPrototypeOf(TrackedWeakMap.prototype, WeakMap.prototype);

export function trackedWeakMap<Key extends WeakKey, Value = unknown>(
  data?: WeakMap<Key, Value>,
  options?: { equals?: (a: Value, b: Value) => boolean; description?: string }
): WeakMap<Key, Value> {
  return new TrackedWeakMap(data ?? [], {
    equals: options?.equals ?? Object.is,
    description: options?.description,
  });
}
