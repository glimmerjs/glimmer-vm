import { Cell } from '@glimmer/validator';

import { module, skip, test } from './-utils';

module('Cell', () => {
  test('creates reactive storage', (assert) => {
    const cell = Cell.create('hello');
    assert.strictEqual(cell.read(), 'hello');
  });

  test('updates when set', (assert) => {
    const cell = Cell.create('hello');
    cell.set('world');
    assert.strictEqual(cell.read(), 'world');
  });

  test('updates when update() is called', (assert) => {
    const cell = Cell.create('hello');
    cell.update((value) => value + ' world');
    assert.strictEqual(cell.read(), 'hello world');
  });

  skip('is frozen when freeze() is called', (assert) => {
    const cell = Cell.create('hello');
    cell.freeze();
    assert.throws(() => cell.set('world'));
  });
});
