import {
  DeeplyConstant,
  getReactiveProperty,
  MutableCell,
  ReadonlyCell,
  type SomeReactive,
  updateReactive,
} from '@glimmer/reference';
import { dirtyTagFor } from '@glimmer/validator';

import { Validate } from './utils/validate';

const { module, test } = QUnit;

module('@glimmer/reference', () => {
  module('MutableCell', () => {
    test("it's a reactive value", () => {
      const cell = MutableCell(0, 'cell');

      const validate = new Validate(cell);

      validate.assertingFresh(0, 'initial');

      updateReactive(cell, 1);
      validate.assertingStale(1, 'updated');
    });

    test(`it can produce property references`, () => {
      const record = { hello: 1 };
      const cell = MutableCell(record, 'cell');

      testPropertyReferences(record, cell, (value) => {
        updateReactive(cell, { hello: value });
      });
    });
  });

  module('ReadonlyCell', () => {
    test(`it's a reactive value`, (assert) => {
      const cell = ReadonlyCell(0, 'cell');

      const validate = new Validate(cell);

      validate.assertingFresh(0, 'initial');

      assert.throws(
        () => updateReactive(cell, 1),
        /^Error: called update on a non-updatable reference$/u
      );
    });

    test(`it can produce property references`, () => {
      const record = { hello: 1 };
      const cell = ReadonlyCell(record, 'cell');

      const updatedValue = testPropertyReferences(record, cell);
      testMutablePropertyReferences(cell, updatedValue);
    });
  });

  module('DeeplyConstant', () => {
    test(`it's a reactive value`, (assert) => {
      const cell = DeeplyConstant(0, 'cell');
      const validate = new Validate(cell);

      validate.assertingFresh(0, 'initial');

      assert.throws(
        () => updateReactive(cell, 1),
        /^Error: called update on a non-updatable reference$/u
      );
    });

    test(`its property references are also deeply constant`, (assert) => {
      const record = { hello: 1 };
      const cell = DeeplyConstant(record, 'cell');

      const property = getReactiveProperty(cell, 'hello');

      const validate = new Validate(property);

      // it's fresh because a deeply constant property is static (not a computation).
      validate.assertingFresh(1, 'initial');

      assert.throws(
        () => updateReactive(property, 2),
        /^Error: called update on a non-updatable reference$/u
      );
    });
  });
});

function testPropertyReferences(
  record: { hello: number },
  reactive: SomeReactive<{ hello: number }>,
  update?: (value: number) => void
) {
  const property = getReactiveProperty(reactive, 'hello');
  const validate = new Validate(property);

  validate.assertingStale(1, 'initial');

  record.hello = 2;
  validate.assertingFresh(1, 'untracked update');

  dirtyTagFor(record, 'hello');
  validate.assertingStale(2, 'tracked update');

  if (update) {
    update(3);
    validate.assertingStale(3, 'replacing the entire value');
    return 3;
  } else {
    return 2;
  }
}

function testMutablePropertyReferences(reactive: SomeReactive<{ hello: number }>, initial: number) {
  const property = getReactiveProperty(reactive, 'hello');
  const validate = new Validate(property);

  validate.assertingFresh(initial, 'initial after testPropertyReferences');

  updateReactive(property, initial + 1);

  validate.assertingStale(initial + 1, 'updated through the reference');
}
