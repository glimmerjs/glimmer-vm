import {
  FallibleFormula,
  Marker,
  MutableCell,
  readReactive,
  ResultFormula,
  type SomeReactive,
  unwrapReactive,
  updateRef,
  validateReactive,
} from '@glimmer/reference';

const { module, test } = QUnit;

module('@glimmer/reference', () => {
  module('errors', () => {
    module('FallibleFormula', () => {
      test(`when the underlying computation becomes stale, there's a chance to recover`, (assert) => {
        const isError = MutableCell(false, 'isError');

        const child = FallibleFormula(() => {
          if (unwrapReactive(isError)) {
            throw new Error('womp womp');
          }

          return true;
        }, 'child');

        const parent = FallibleFormula(() => {
          return unwrapReactive(child);
        }, 'parent');

        const validate = new Validate(parent);

        // the reactive value is stale before the first time it is read
        assert.true(validate.assertingStale(), `the initial value is true`);

        updateRef(isError, true);
        validate.assertingStaleError(/^Error: womp womp$/u);

        updateRef(isError, false);
        assert.true(validate.assertingStale(), `the value is now false`);

        updateRef(isError, true);
        validate.assertingStaleError(/^Error: womp womp$/u);
      });

      test(`an externally recoverable error`, (assert) => {
        // represent state that isn't tracked by the reactivity system, but which we might know has
        // changed enough to justify recovery.
        let isError = true;
        const tryRecover = Marker('tryRecover');

        // this formula will never invalidate on its own, since it doesn't read from any reactive
        // state.
        const child = FallibleFormula(() => {
          if (isError) {
            throw new Error('womp womp');
          }

          return true;
        }, 'child');

        const withRecovery = ResultFormula(() => {
          tryRecover.consume();
          return readReactive(child);
        }, 'parent');

        const validate = new Validate(withRecovery);

        validate.assertingStaleError(/^Error: womp womp$/u);

        tryRecover.mark();
        validate.assertingStaleError(/^Error: womp womp$/u);

        isError = false;
        tryRecover.mark();
        assert.true(validate.assertingStale());
      });
    });
  });
});

class Validate<T> {
  readonly #reference: SomeReactive<T>;

  constructor(reactive: SomeReactive<T>) {
    this.#reference = reactive;
  }

  assertingStaleError(expected: RegExp): void {
    QUnit.assert.ok(this.isStale, `expected reference to be stale`);
    QUnit.assert.throws(() => this.value, expected, `expected reference to throw`);
    this.#assertingFreshError(expected, `immediately after throwing`);
  }

  assertingFreshError(expected: RegExp): void {
    this.#assertingFreshError(expected);
    this.#assertingFreshError(expected, `immediately after a fresh error`);
  }

  #assertingFreshError(expected: RegExp, message?: string): void {
    QUnit.assert.ok(!this.isStale, `expected reference to be fresh`);
    QUnit.assert.throws(
      () => this.value,
      expected,
      `${message ? `${message}: ` : ''}expected reference to throw`
    );
  }

  assertingStale(): T {
    QUnit.assert.true(this.isStale, `expected reference to be stale`);
    return this.value;
  }

  assertingFresh() {
    QUnit.assert.false(this.isStale, `expected reference to be fresh`);
    return this.value;
  }

  get isStale() {
    return !validateReactive(this.#reference);
  }

  get value() {
    return unwrapReactive(this.#reference);
  }
}
