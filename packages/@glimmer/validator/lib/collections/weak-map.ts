class TrackedWeakMap<K extends object = object, V = unknown> implements WeakMap<K, V> {
  private storages: WeakMap<K, TrackedStorage<null>> = new WeakMap();

  private vals: WeakMap<K, V>;

  private readStorageFor(key: K): void {
    const { storages } = this;
    let storage = storages.get(key);

    if (storage === undefined) {
      storage = createStorage(null, () => false);
      storages.set(key, storage);
    }

    getValue(storage);
  }

  private dirtyStorageFor(key: K): void {
    const storage = this.storages.get(key);

    if (storage) {
      setValue(storage, null);
    }
  }

  constructor();
  constructor(iterable: Iterable<readonly [K, V]>);
  constructor(entries: readonly [K, V][] | null);
  constructor(existing?: readonly [K, V][] | Iterable<readonly [K, V]> | null) {
    // TypeScript doesn't correctly resolve the overloads for calling the `Map`
    // constructor for the no-value constructor. This resolves that.
    this.vals = existing ? new WeakMap(existing) : new WeakMap();
  }

  get(key: K): V | undefined {
    this.readStorageFor(key);

    return this.vals.get(key);
  }

  has(key: K): boolean {
    this.readStorageFor(key);

    return this.vals.has(key);
  }

  set(key: K, value: V): this {
    this.dirtyStorageFor(key);

    this.vals.set(key, value);

    return this;
  }

  delete(key: K): boolean {
    this.dirtyStorageFor(key);

    this.storages.delete(key);
    return this.vals.delete(key);
  }

  get [Symbol.toStringTag](): string {
    return this.vals[Symbol.toStringTag];
  }
}

// So instanceof works
Object.setPrototypeOf(TrackedWeakMap.prototype, WeakMap.prototype);

export function trackedWeakMap<Key extends WeakKey, Value = unknown>(
  data?: WeakMap<Key, Value>,
  options?: { equals?: (a: T, b: T) => boolean; description?: string }
): WeakMap<Key, Value> {
  return new TrackedWeakMap(data ?? [], {
    equals: options?.equals ?? Object.is,
    description: options?.description,
  });
}
