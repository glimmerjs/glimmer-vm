import type { ReactiveOptions } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { consumeTag } from '../tracking';
import { createUpdatableTag, DIRTY_TAG } from '../validators';

const ARRAY_GETTER_METHODS = new Set<string | symbol | number>([
  Symbol.iterator,
  'concat',
  'entries',
  'every',
  'filter',
  'find',
  'findIndex',
  'flat',
  'flatMap',
  'forEach',
  'includes',
  'indexOf',
  'join',
  'keys',
  'lastIndexOf',
  'map',
  'reduce',
  'reduceRight',
  'slice',
  'some',
  'values',
]);

const ARRAY_COLLECTION_SET_METHODS = new Set<string | symbol>([
  'copyWithin',
  'fill',
  'pop',
  'push',
  'reverse',
  'shift',
  'sort',
  'splice',
  'unshift',
]);

class TrackedArray<V> implements Array {
  #options: ReactiveOptions<V>;
  #collection = createUpdatableTag();
  #storages = new Map<number, ReturnType<typeof createUpdatableTag>>();
  #vals: Map<number, V>;

  #storageFor(key: number): ReturnType<typeof createUpdatableTag> {
    const storages = this.#storages;
    let storage = storages.get(key);

    if (storage === undefined) {
      storage = createUpdatableTag();
      storages.set(key, storage);
    }

    return storage;
  }
  #dirtyStorageFor(key: number): void {
    const storage = this.#storages.get(key);

    if (storage) {
      DIRTY_TAG(storage);
    }
  }

  constructor(existing: V[], options: ReactiveOptions<V>) {
    // TypeScript doesn't correctly resolve the overloads for calling the `Map`
    // constructor for the no-value constructor. This resolves that.
    this.#vals = existing instanceof Map ? new Map(existing.entries()) : new Map(existing);
    this.#options = options;
  }
}

// For these methods, `Array` itself immediately gets the `.length` to return
// after invoking them.
const ARRAY_WRITE_THEN_READ_METHODS = new Set<string | symbol>(['fill', 'push', 'unshift']);

function convertToInt(prop: number | string | symbol): number | null {
  if (typeof prop === 'symbol') return null;

  const num = Number(prop);

  if (isNaN(num)) return null;

  return num % 1 === 0 ? num : null;
}

class OldTrackedArray<T = unknown> {
  #options: { equals: (a: T, b: T) => boolean; description: string | undefined };

  constructor(
    arr: T[],
    options: { equals: (a: T, b: T) => boolean; description: string | undefined }
  ) {
    this.#options = options;

    const clone = arr.slice();
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    const boundFns = new Map<string | symbol, (...args: any[]) => any>();

    /**
      Flag to track whether we have *just* intercepted a call to `.push()` or
      `.unshift()`, since in those cases (and only those cases!) the `Array`
      itself checks `.length` to return from the function call.
     */
    let nativelyAccessingLengthFromPushOrUnshift = false;

    return new Proxy(clone, {
      get(target, prop /*, _receiver */) {
        const index = convertToInt(prop);

        if (index !== null) {
          self.#readStorageFor(index);
          // consumeTag(self.#collection);

          return target[index];
        }

        if (prop === 'length') {
          // If we are reading `.length`, it may be a normal user-triggered
          // read, or it may be a read triggered by Array itself. In the latter
          // case, it is because we have just done `.push()` or `.unshift()`; in
          // that case it is safe not to mark this as a *read* operation, since
          // calling `.push()` or `.unshift()` cannot otherwise be part of a
          // "read" operation safely, and if done during an *existing* read
          // (e.g. if the user has already checked `.length` *prior* to this),
          // that will still trigger the mutation-after-consumption assertion.
          if (nativelyAccessingLengthFromPushOrUnshift) {
            nativelyAccessingLengthFromPushOrUnshift = false;
          } else {
            consumeTag(self.#collection);
          }

          return target[prop];
        }

        // Here, track that we are doing a `.push()` or `.unshift()` by setting
        // the flag to `true` so that when the `.length` is read by `Array` (see
        // immediately above), it knows not to dirty the collection.
        if (ARRAY_WRITE_THEN_READ_METHODS.has(prop)) {
          nativelyAccessingLengthFromPushOrUnshift = true;
        }

        if (ARRAY_GETTER_METHODS.has(prop)) {
          let fn = boundFns.get(prop);

          if (fn === undefined) {
            fn = (...args) => {
              consumeTag(self.#collection);
              // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
              return (target as any)[prop](...args);
            };

            boundFns.set(prop, fn);
          }

          return fn;
        }

        if (ARRAY_COLLECTION_SET_METHODS.has(prop)) {
          let fn = boundFns.get(prop);

          if (fn === undefined) {
            fn = (...args) => {
              console.log('dirtying collection ', prop, args);
              self.#dirtyCollection();
              // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
              return (target as any)[prop](...args);
            };

            boundFns.set(prop, fn);
          }
          return fn;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
        return (target as any)[prop];
      },

      set(target, prop, value /*, _receiver */) {
        const index = convertToInt(prop);

        if (prop === 'length') {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
          let isUnchanged = self.#options.equals((target as any)[prop], value);
          if (isUnchanged) return true;
          self.#dirtyCollection();
        }

        if (index !== null) {
          let alreadyHas = (index ?? Infinity) < target.length;
          if (alreadyHas) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
            let isUnchanged = self.#options.equals((target as any)[prop], value);
            if (isUnchanged) return true;
          }

          self.#dirtyStorageFor(index);

          if (!alreadyHas) {
            self.#dirtyCollection();
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        (target as any)[prop] = value;

        return true;
      },

      getPrototypeOf() {
        return TrackedArray.prototype;
      },
    }) as TrackedArray<T>;
  }

  #collection = createUpdatableTag();

  #storages = new Map<number, ReturnType<typeof createUpdatableTag>>();

  #readStorageFor(index: number) {
    let storage = this.#storages.get(index);

    if (storage === undefined) {
      storage = createUpdatableTag();
      this.#storages.set(index, storage);
    }

    consumeTag(storage);
  }

  #dirtyStorageFor(index: number): void {
    const storage = this.#storages.get(index);

    if (storage) {
      DIRTY_TAG(storage);
    }
  }

  #dirtyCollection() {
    DIRTY_TAG(this.#collection);
  }
}

// This rule is correct in the general case, but it doesn't understand
// declaration merging, which is how we're using the interface here. This says
// `TrackedArray` acts just like `Array<T>`, but also has the properties
// declared via the `class` declaration above -- but without the cost of a
// subclass, which is much slower that the proxied array behavior. That is: a
// `TrackedArray` *is* an `Array`, just with a proxy in front of accessors and
// setters, rather than a subclass of an `Array` which would be de-optimized by
// the browsers.
//

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface TrackedArray<T = unknown> extends Array<T> {}

// Ensure instanceof works correctly
Object.setPrototypeOf(TrackedArray.prototype, Array.prototype);

export function trackedArray<T = unknown>(
  data?: T[],
  options?: { equals?: (a: T, b: T) => boolean; description?: string }
): T[] {
  return new OldTrackedArray(data ?? [], {
    equals: options?.equals ?? Object.is,
    description: options?.description,
  });
}
