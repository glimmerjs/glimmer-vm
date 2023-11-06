import { MutableCell, unwrapReactive } from '@glimmer/reference';

const { module, test } = QUnit;

module('@glimmer/reference', () => {
  module('MutableCell', () => {
    test("it's a reactive value", (assert) => {
      const cell = MutableCell(0, 'cell');

      assert.strictEqual(unwrapReactive(cell), 0);
    });
  });
});
