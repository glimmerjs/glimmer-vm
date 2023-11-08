import {
  clearError,
  FallibleFormula,
  MutableCell,
  readReactive,
  unwrapReactive,
  updateReactive,
} from '@glimmer/reference';

import { Validate } from './utils/validate';

const { module, test } = QUnit;

module('@glimmer/reference', () => {
  module('errors', () => {
    module('FallibleFormula', () => {
      test(`when the underlying computation becomes stale, there's a chance to recover`, () => {
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
        validate.assertingStale(true, 'initial');

        updateReactive(isError, true);
        validate.assertingStaleError(/^Error: womp womp$/u);

        updateReactive(isError, false);
        validate.assertingStale(true, 'updated');

        updateReactive(isError, true);
        validate.assertingStaleError(/^Error: womp womp$/u);
      });

      test(`a getter doesn't run again after it happened`, (assert) => {
        let events: string[] = [];

        const formula = FallibleFormula(() => {
          events.push('formula ran');

          throw Error('womp womp');
        });

        assert.strictEqual(readReactive(formula).type, 'err', 'the formula is in an error state');
        assert.deepEqual(events, ['formula ran']);

        events = [];

        assert.strictEqual(readReactive(formula).type, 'err', 'the formula is in an error state');
        assert.deepEqual(events, []);
      });

      test(`an externally recoverable error`, () => {
        // represent state that isn't tracked by the reactivity system, but which we might know has
        // changed enough to justify recovery.
        let isError = true;

        // this formula will never invalidate on its own, since it doesn't read from any reactive
        // state.
        const formula = FallibleFormula(() => {
          if (isError) {
            throw new Error('womp womp');
          }

          return true;
        }, 'child');

        const validate = new Validate(formula);

        step(`initial state`);
        validate.assertingStaleError(/^Error: womp womp$/u);

        step(`updating, still an error`);
        clearError(formula);
        validate.assertingStaleError(/^Error: womp womp$/u);

        step(`updating, not an error`);
        isError = false;
        clearError(formula);
        validate.assertingStale(true, 'after recovery');
      });
    });
  });
});

export function step(message: string) {
  QUnit.assert.ok(true, `>> ${message} <<`);
}
