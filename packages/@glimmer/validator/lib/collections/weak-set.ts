class TrackedWeakSet<T extends object = object> implements WeakSet<T> {
  private storages: WeakMap<T, TrackedStorage<null>> = new WeakMap();

  private vals: WeakSet<T>;

  private storageFor(key: T): TrackedStorage<null> {
    const storages = this.storages;
    let storage = storages.get(key);

    if (storage === undefined) {
      storage = createStorage(null, () => false);
      storages.set(key, storage);
    }

    return storage;
  }

  private dirtyStorageFor(key: T): void {
    const storage = this.storages.get(key);

    if (storage) {
      setValue(storage, null);
    }
  }

  constructor(values?: readonly T[] | null) {
    this.vals = new WeakSet(values);
  }

  has(value: T): boolean {
    getValue(this.storageFor(value));

    return this.vals.has(value);
  }

  add(value: T): this {
    // Add to vals first to get better error message
    this.vals.add(value);

    this.dirtyStorageFor(value);

    return this;
  }

  delete(value: T): boolean {
    this.dirtyStorageFor(value);

    this.storages.delete(value);
    return this.vals.delete(value);
  }

  get [Symbol.toStringTag](): string {
    return this.vals[Symbol.toStringTag];
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
