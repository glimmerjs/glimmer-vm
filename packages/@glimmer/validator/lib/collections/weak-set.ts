import { consumeTag } from '../tracking';
import { createUpdatableTag, DIRTY_TAG } from '../validators';

class TrackedWeakSet<T extends object = object> implements WeakSet<T> {
  #storages = new WeakMap<T, ReturnType<typeof createUpdatableTag>>();
  #vals: WeakSet<T>;

  #storageFor(key: T): TrackedStorage<null> {
    let storage = this.#storages.get(key);

    if (storage === undefined) {
      storage = createUpdatableTag();
      this.#storages.set(key, storage);
    }

    return storage;
  }

  #dirtyStorageFor(key: T): void {
    const storage = this.#storages.get(key);

    if (storage) {
      DIRTY_TAG(storage);
    }
  }

  constructor(values?: readonly T[] | null) {
    this.#vals = new WeakSet(values);
  }

  has(value: T): boolean {
    consumeTag(this.#storageFor(value));

    return this.#vals.has(value);
  }

  add(value: T): this {
    // Add to vals first to get better error message
    this.#vals.add(value);

    this.#dirtyStorageFor(value);

    return this;
  }

  delete(value: T): boolean {
    this.#dirtyStorageFor(value);

    this.#storages.delete(value);
    return this.#vals.delete(value);
  }

  get [Symbol.toStringTag](): string {
    return this.#vals[Symbol.toStringTag];
  }
}

// So instanceof works
Object.setPrototypeOf(TrackedWeakSet.prototype, WeakSet.prototype);

export function trackedWeakSet<Value = unknown>(
  data?: WeakSet<Value>,
  options?: { equals?: (a: Value, b: Value) => boolean; description?: string }
): WeakSet<Value> {
  return new TrackedWeakSet(data ?? [], {
    equals: options?.equals ?? Object.is,
    description: options?.description,
  });
}
