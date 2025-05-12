import { consumeTag } from '../tracking';
import { createUpdatableTag, DIRTY_TAG } from '../validators';

class TrackedWeakSet<T extends object = object> implements WeakSet<T> {
  #options: { equals: (a: T, b: T) => boolean; description: string | undefined };
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

  constructor(
    values: readonly T[],
    options: { equals: (a: T, b: T) => boolean; description: string | undefined }
  ) {
    this.#options = options;
    this.#vals = new WeakSet(values);
  }

  has(value: T): boolean {
    consumeTag(this.#storageFor(value));

    return this.#vals.has(value);
  }

  add(value: T): this {
    /**
     * In a WeakSet, there is no `.get()`, but if there was,
     * we could assume it's the same value as what we passed.
     *
     * So for a WeakSet, if we try to add something that already exists
     * we no-op.
     *
     * WeakSet already does this internally for us,
     * but we want the ability for the reactive behavior to reflect the same behavior.
     *
     * i.e.: doing weakSet.add(value) should never dirty with the defaults
     *       if the `value` is already in the weakSet
     */
    if (this.#vals.has(value)) {
      /**
       * This looks a little silly, where a always will === b,
       * but see the note above.
       */
      let isUnchanged = this.#options.equals(value, value);
      if (isUnchanged) return this;
    }

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
