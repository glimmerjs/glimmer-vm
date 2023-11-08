import type { SomeReactive } from '@glimmer/interfaces';

import { hasError, unwrapReactive, validateReactive } from '@glimmer/reference';

export class Validate<T> {
  readonly #reference: SomeReactive<T>;

  constructor(reactive: SomeReactive<T>) {
    this.#reference = reactive;
  }

  assertingStaleError(expected: RegExp): void {
    this.#assertingStaleError(expected);
    this.#assertingFreshError(expected, `immediately after throwing`);
  }

  assertingFreshError(expected: RegExp): void {
    this.#assertingFreshError(expected);
    this.#assertingFreshError(expected, `immediately after a fresh error`);
  }

  #assertingStaleError(expected: RegExp): void {
    QUnit.assert.ok(this.isStale, `expected reference to be stale`);
    QUnit.assert.throws(() => this.value, expected, `expected reference to throw`);
    QUnit.assert.true(hasError(this.#reference), `expected reference to return true from hasError`);
  }

  #assertingFreshError(expected: RegExp, message?: string): void {
    QUnit.assert.ok(!this.isStale, `expected reference to be fresh`);
    QUnit.assert.throws(
      () => this.value,
      expected,
      `${message ? `${message}: ` : ''}expected reference to throw`
    );
    QUnit.assert.true(hasError(this.#reference), `expected reference to return true from hasError`);
  }

  assertingStale(value: T, description: string): void {
    QUnit.assert.true(this.isStale, `expected reference (${description}) to be stale`);
    QUnit.assert.strictEqual(
      this.value,
      value,
      `expected value (${description}) to be ${JSON.stringify(value)}`
    );
    QUnit.assert.false(
      hasError(this.#reference),
      `expected reference (${description}) to return false from hasError`
    );
  }

  assertingFresh(value: T, description: string): void {
    QUnit.assert.false(this.isStale, `expected reference (${description}) to be fresh`);
    QUnit.assert.strictEqual(
      this.value,
      value,
      `expected value (${description}) to be ${JSON.stringify(value)}}`
    );
    QUnit.assert.false(
      hasError(this.#reference),
      `expected reference (${description}) to return false from hasError`
    );
  }

  get isStale() {
    return !validateReactive(this.#reference);
  }

  get value() {
    return unwrapReactive(this.#reference);
  }
}
