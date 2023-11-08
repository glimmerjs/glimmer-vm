import type { MutableReactiveCell, SomeReactive } from '@glimmer/interfaces';

import {
  Accessor,
  FallibleFormula,
  MutableCell,
  readCell,
  ResultFormula,
  updateReactive,
  writeCell,
} from '@glimmer/reference';
import { Err, Ok, UserException } from '@glimmer/util';

import { step } from './error-test';
import { Validate } from './utils/validate';

const { module, test } = QUnit;

module('@glimmer/reference', () => {
  module('FallibleFormula', () => {
    test(`errors in the formula turn into Err values when the reference is read`, () => {
      const isError = MutableCell(false, 'isError');

      const formula = FallibleFormula(() => {
        if (readCell(isError)) {
          throw new Error('womp womp');
        } else {
          return true;
        }
      });

      testResult(formula, isError);
    });
  });

  module('ResultFormula', () => {
    test('if the formula returns an Err, the reference is in an error state', () => {
      const isError = MutableCell(false, 'isError');

      const formula = ResultFormula(() => {
        if (readCell(isError)) {
          return Err(UserException.from(new Error('womp womp'), `womp womp`));
        } else {
          return Ok(true);
        }
      });

      testResult(formula, isError);
    });
  });

  module('Accessor', () => {
    test('if the getter throws an error, the reference is in an error state', () => {
      const getError = MutableCell(false, 'getError');
      let setError = false;
      const value = MutableCell(true, 'value');

      const accessor = Accessor({
        get: () => {
          if (setError) {
            throw new Error('set: womp womp');
          } else if (readCell(getError)) {
            throw new Error('womp womp');
          } else {
            return readCell(value);
          }
        },
        set: (newValue: boolean) => {
          if (setError) {
            throw new Error('set: womp womp');
          } else {
            writeCell(value, newValue);
          }
        },
      });

      const validate = testResult(accessor, getError);

      step('updating the reactive');
      updateReactive(accessor, false);
      validate.assertingStale(false, 'updated');

      setError = true;
      step('updating the reactive again, but the setter throws');
      updateReactive(accessor, true);

      validate.assertingStaleError(/^Error: set: womp womp$/u);
    });
  });
});

function testResult(reactive: SomeReactive<boolean>, isError: MutableReactiveCell<boolean>) {
  const validate = new Validate(reactive);

  validate.assertingStale(true, 'initial');

  writeCell(isError, true);

  validate.assertingStaleError(/^Error: womp womp$/u);

  writeCell(isError, false);

  validate.assertingStale(true, 'updated');

  return validate;
}
