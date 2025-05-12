import Component from '@glimmer/component';
import { setupRenderingTest } from 'ember-qunit';
import { module, test } from 'qunit';
import { TrackedWeakSet } from 'tracked-built-ins';

import { reactivityTest } from '../helpers/reactivity';

module('TrackedWeakSet', function (hooks) {
  setupRenderingTest(hooks);

  test('constructor', (assert) => {
    const obj = {};
    const set = new TrackedWeakSet([obj]);

    assert.true(set.has(obj));
    assert.ok(set instanceof WeakSet);

    const array = [1, 2, 3];
    const iterable = [array];
    const fromIterable = new TrackedWeakSet(iterable);
    assert.true(fromIterable.has(array));
  });

  test('does not work with built-ins', (assert) => {
    const set = new TrackedWeakSet();

    // @ts-expect-error -- point is testing constructor error
    assert.throws(() => set.add('aoeu'), /Invalid value used in weak set/u);
    // @ts-expect-error -- point is testing constructor error
    assert.throws(() => set.add(true), /Invalid value used in weak set/u);
    // @ts-expect-error -- point is testing constructor error
    assert.throws(() => set.add(123), /Invalid value used in weak set/u);
    // @ts-expect-error -- point is testing constructor error
    assert.throws(() => set.add(undefined), /Invalid value used in weak set/u);
  });

  test('add/has', (assert) => {
    const obj = {};
    const set = new TrackedWeakSet();

    set.add(obj);
    assert.true(set.has(obj));
  });

  test('delete', (assert) => {
    const obj = {};
    const set = new TrackedWeakSet();

    assert.false(set.has(obj));

    set.add(obj);
    assert.true(set.has(obj));

    set.delete(obj);
    assert.false(set.has(obj));
  });

  reactivityTest(
    'add/has',
    class extends Component {
      obj = {};
      set = new TrackedWeakSet();

      get value() {
        return this.set.has(this.obj);
      }

      update() {
        this.set.add(this.obj);
      }
    }
  );

  reactivityTest(
    'add/has existing value',
    class extends Component {
      obj = {};
      obj2 = {};
      set = new TrackedWeakSet([this.obj]);

      get value() {
        return this.set.has(this.obj);
      }

      update() {
        this.set.add(this.obj);
      }
    }
  );

  reactivityTest(
    'add/has unrelated value',
    class extends Component {
      obj = {};
      obj2 = {};
      set = new TrackedWeakSet();

      get value() {
        return this.set.has(this.obj);
      }

      update() {
        this.set.add(this.obj2);
      }
    },
    false
  );

  reactivityTest(
    'delete',
    class extends Component {
      obj = {};
      obj2 = {};
      set = new TrackedWeakSet([this.obj, this.obj2]);

      get value() {
        return this.set.has(this.obj);
      }

      update() {
        this.set.delete(this.obj);
      }
    }
  );

  reactivityTest(
    'delete unrelated value',
    class extends Component {
      obj = {};
      obj2 = {};
      set = new TrackedWeakSet([this.obj, this.obj2]);

      get value() {
        return this.set.has(this.obj);
      }

      update() {
        this.set.delete(this.obj2);
      }
    },
    false
  );
});
