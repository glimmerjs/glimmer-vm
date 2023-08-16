import type { Reactive } from '@glimmer/reference';
import {
  ComputedCell,
  DeeplyReadonlyCell,
  getReactiveProperty,
  MutableCell,
  readCell,
  ReadonlyCell,
  updateReactive,
  writeCell,
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
      const counter = ReadonlyCell(0, 'counter');

      const validate = new Validate(counter);

      validate.assertingFresh(0, 'initial');

      assert.throws(
        () => updateReactive(counter, 1),
        /^Error: cannot update readonly cell \(`counter`\)$/u
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
      const cell = DeeplyReadonlyCell(0, 'cell');
      const validate = new Validate(cell);

      validate.assertingFresh(0, 'initial');

      assert.throws(
        () => updateReactive(cell, 1),
        /^Error: cannot update deeply readonly cell \(`cell`\)$/u
      );
    });

    test(`its property references are also deeply constant`, (assert) => {
      const counterRecord = { count: 1 };
      const counter = DeeplyReadonlyCell(counterRecord, 'counter');

      const property = getReactiveProperty(counter, 'count');

      const validate = new Validate(property);

      // it's fresh because a deeply constant property is static (not a computation).
      validate.assertingFresh(1, 'initial');

      assert.throws(
        () => updateReactive(property, 2),
        /^Error: cannot update property reference \(`counter.count`\)$/u
      );
    });
  });

  module('ComputedCell', () => {
    test(`it's a reactive value and behaves like a cell`, (assert) => {
      const counter = MutableCell(0);

      const incremented = ComputedCell(() => {
        return readCell(counter) + 1;
      });

      const validate = new Validate(incremented);

      validate.assertingStale(1, 'initial');

      assert.strictEqual(readCell(incremented), 1, 'incremented');

      writeCell(counter, 1);

      assert.strictEqual(readCell(incremented), 2, 'incremented again');
      validate.assertingFresh(2, 'updated');

      writeCell(counter, 2);

      validate.assertingStale(3, 'updated again');
      assert.strictEqual(readCell(incremented), 3, 'incremented again');
    });
  });
});

function testPropertyReferences(
  record: { hello: number },
  reactive: Reactive<{ hello: number }>,
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

function testMutablePropertyReferences(reactive: Reactive<{ hello: number }>, initial: number) {
  const property = getReactiveProperty(reactive, 'hello');
  const validate = new Validate(property);

  validate.assertingFresh(initial, 'initial after testPropertyReferences');

  updateReactive(property, initial + 1);

  validate.assertingStale(initial + 1, 'updated through the reference');
}
