import {
  FallibleFormula,
  Marker,
  MutableCell,
  readReactive,
  ResultFormula,
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

      test(`an externally recoverable error`, () => {
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
        validate.assertingStale(true, 'after recovery');
      });
    });
  });
});
