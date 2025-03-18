import { runtime, ValueTag, type Tag } from './pseudocode';

type Last<T> = { value: T; tag: Tag; revision: number };

export class PrimitiveCache<T> {
  readonly #compute: () => T;
  #last: Last<T>;

  constructor(compute: () => T) {
    this.#compute = compute;

    // A `PrimitiveCache` must always be initialized with a value. If all of the primitives used
    // inside of a `PrimitiveCache` are compliant with the Fundamental Laws of Reactivity, then
    // initializing a cache will never change the revision counter.
    this.read();
  }

  /**
   * Unsafely read the status of the cache. This is unsafe because it exposes the raw value of the
   * tag and the last value of the cache, but relies on the caller to ensure that the tag is
   * consumed if the abstraction needs to invalidate when the cache changes.
   *
   * Callers of `status` must satisfy the transactionality law by consuming the tag whenever a
   * change to the value would result in a change to the computed value of the abstraction.
   */
  unsafeStatus(): Last<T> {
    return this.#last;
  }

  /**
   * Safely read the value of the cache. This satisfies the transactionality law because:
   *
   * 1. If the cache is valid, then it will return the last value of the cache. This is guaranteed
   *    to be the same value for all reads in the same rendering transaction because any mutations
   *    to any _members_ of the last tag will trigger a backtracking assertion.
   * 2. If the cache is invalid, then the previous value of the cache is thrown away and the
   *    computation is run again. Any subsequent reads from the cache will return the same value
   *    because of (1).
   */
  read(): T {
    if (this.#last && this.#last.revision >= this.#last.tag.revision) {
      runtime.consume(this.#last.tag);
      return this.#last.value;
    }

    runtime.begin();
    try {
      const result = this.#compute();
      const tag = runtime.commit();
      this.#last = { value: result, tag, revision: runtime.current() };
      runtime.consume(tag);
      return result;
    } catch (e) {
      // This is possible, but not currently modelled at all. The approach used by the error
      // recovery branch that was not merged is: tags are permitted to capture errors, and
      // value abstractions expose those errors in their safe read() abstractions.
      throw e;
    }
  }
}

type PrimitiveValue<T> = { status: 'uninitialized' } | { status: 'initialized'; value: T };
type PrimitiveStatus<T> =
  | { status: 'uninitialized'; tag: Tag }
  | { status: 'initialized'; value: T; tag: Tag };

export class PrimitiveCell<T> {
  readonly #tag: ValueTag = ValueTag.init(this, 'value');
  #value: PrimitiveValue<T>;

  /**
   * Unsafely read the value of the cell. This is unsafe because it exposes the raw value of the tag
   * and the last value of the cell, but relies on the caller to ensure that the tag is consumed if
   * the abstraction needs to invalidate when the cell changes.
   *
   * Callers of `status` must satisfy the transactionality law by consuming the tag whenever a
   * change to the value would result in a change to the computed value of the abstraction.
   *
   * ## Note
   *
   * The `uninitialized` status allows the cell to be initialized without a value, which allows
   * other abstractions to invalidate when the cell _is_ initialized, but to choose to return the
   * value of a different reactive abstraction.
   *
   * This allows a cell's value to be set to `undefined` by its user, and for abstractions to
   * allow an intentionally set `undefined` to "win" over another default value.
   *
   * In the case of `LocalCopy` below, this allows the user to set the local copy to `undefined`,
   * which will win out over the original computation if it is more recent than the revision of the
   * original computation.
   */
  unsafeStatus(): PrimitiveStatus<T> {
    if (this.#value.status === 'uninitialized') {
      return { status: 'uninitialized', tag: this.#tag };
    } else {
      return { status: 'initialized', value: this.#value.value, tag: this.#tag };
    }
  }

  write(value: T): void {
    this.#tag.update();
    this.#value = { status: 'initialized', value };
  }
}

export class LocalCopy<T> {
  readonly #original: PrimitiveCache<T>;
  readonly #local: PrimitiveCell<T>;

  constructor(compute: () => T) {
    this.#original = new PrimitiveCache(compute);
    this.#local = new PrimitiveCell();
  }

  /**
   * Safely read the value of the `LocalCopy`. The newer of the original computation or the local
   * cell will be returned, and the `LocalCopy` will invalidate if either the local cell or the
   * original computation invalidates.
   *
   *
   *
   * This satisfies the transactionality law because we consume both the `local` tag and the
   * `original` tag in all cases, which means that:
   *
   * 1. The value of the `local` cell cannot change after the `LocalCopy` was computed in the same
   *    rendering transaction, because it would trigger a backtracking assertion.
   * 2. The value of the original computation cannot change in the same rendering transaction, since
   *    a change to any of its members would trigger a backtracking assertion.
   *
   * To ensure that `read()`ing the `LocalCopy` does not _itself_ trigger a backtracking assertion,
   * nothing in its implementation updates a `ValueTag`.
   */
  read(): T {
    const local = this.#local.unsafeStatus();
    const original = this.#original.unsafeStatus();

    // Regardless of the status of the local cell or original computation, if the local cell
    // changes, the `LocalCopy` should invalidate.
    runtime.consume(local.tag);

    // If the local tag is newer than the original tag, then we will return the local value, and
    // invalidate the `LocalCopy` if either the local tag or the original tag have changed.
    if (local.status === 'initialized' && local.tag.revision > original.tag.revision) {
      // Consume the original tag even though we're not reading its value. This ensures that if any
      // member of the original computation changes, the `LocalCopy` will invalidate, and the next
      // `read()` will return the value of the original computation rather than the local value.
      runtime.consume(original.tag);
      return local.value;
    }

    // Otherwise, we will safely read the original value. This reliably produces the same value
    // throughout the rendering transaction, and makes the `LocalCopy` invalidate if the original
    // computation invalidates.
    return this.#original.read();
  }
}
