import Component from '@glimmer/component';
import { setupRenderingTest } from 'ember-qunit';
import { expectTypeOf } from 'expect-type';
import { module, test } from 'qunit';
import { TrackedMap } from 'tracked-built-ins';

import { eachInReactivityTest, eachReactivityTest } from '../helpers/collection-reactivity';
import { reactivityTest } from '../helpers/reactivity';

expectTypeOf<TrackedMap<string, number>>().toMatchTypeOf<Map<string, number>>();
expectTypeOf<Map<string, number>>().not.toMatchTypeOf<TrackedMap<string, number>>();

module('TrackedMap', function (hooks) {
  setupRenderingTest(hooks);

  test('constructor', (assert) => {
    const map = new TrackedMap([['foo', 123]]);

    assert.equal(map.get('foo'), 123);
    assert.equal(map.size, 1);
    assert.ok(map instanceof Map);
  });

  test('works with all kinds of keys', (assert) => {
    const map = new TrackedMap<unknown, unknown>([
      ['foo', 123],
      [{}, {}],
      [
        () => {
          /* no op! */
        },
        'bar',
      ],
      [123, true],
      [true, false],
      [null, null],
    ]);

    assert.equal(map.size, 6);
  });

  test('get/set', (assert) => {
    const map = new TrackedMap();

    map.set('foo', 123);
    assert.equal(map.get('foo'), 123);

    map.set('foo', 456);
    assert.equal(map.get('foo'), 456);
  });

  test('has', (assert) => {
    const map = new TrackedMap();

    assert.false(map.has('foo'));
    map.set('foo', 123);
    assert.true(map.has('foo'));
  });

  test('entries', (assert) => {
    const map = new TrackedMap();
    map.set(0, 1);
    map.set(1, 2);
    map.set(2, 3);

    const iter = map.entries();

    assert.deepEqual(iter.next().value, [0, 1]);
    assert.deepEqual(iter.next().value, [1, 2]);
    assert.deepEqual(iter.next().value, [2, 3]);
    assert.true(iter.next().done);
  });

  test('keys', (assert) => {
    const map = new TrackedMap();
    map.set(0, 1);
    map.set(1, 2);
    map.set(2, 3);

    const iter = map.keys();

    assert.equal(iter.next().value, 0);
    assert.equal(iter.next().value, 1);
    assert.equal(iter.next().value, 2);
    assert.true(iter.next().done);
  });

  test('values', (assert) => {
    const map = new TrackedMap();
    map.set(0, 1);
    map.set(1, 2);
    map.set(2, 3);

    const iter = map.values();

    assert.equal(iter.next().value, 1);
    assert.equal(iter.next().value, 2);
    assert.equal(iter.next().value, 3);
    assert.true(iter.next().done);
  });

  test('forEach', (assert) => {
    const map = new TrackedMap();
    map.set(0, 1);
    map.set(1, 2);
    map.set(2, 3);

    let count = 0;
    let values = '';

    map.forEach((v, k) => {
      count++;
      values += k;
      values += v;
    });

    assert.equal(count, 3);
    assert.equal(values, '011223');
  });

  test('size', (assert) => {
    const map = new TrackedMap();
    assert.equal(map.size, 0);

    map.set(0, 1);
    assert.equal(map.size, 1);

    map.set(1, 2);
    assert.equal(map.size, 2);

    map.delete(1);
    assert.equal(map.size, 1);

    map.set(0, 3);
    assert.equal(map.size, 1);
  });

  test('delete', (assert) => {
    const map = new TrackedMap();

    assert.false(map.has(0));

    map.set(0, 123);
    assert.true(map.has(0));

    map.delete(0);
    assert.false(map.has(0));
  });

  test('clear', (assert) => {
    const map = new TrackedMap();

    map.set(0, 1);
    map.set(1, 2);
    assert.equal(map.size, 2);

    map.clear();
    assert.equal(map.size, 0);
    assert.equal(map.get(0), undefined);
    assert.equal(map.get(1), undefined);
  });

  reactivityTest(
    'get/set',
    class extends Component {
      map = new TrackedMap();

      get value() {
        return this.map.get('foo');
      }

      update() {
        this.map.set('foo', 123);
      }
    }
  );

  reactivityTest(
    'get/set existing value',
    class extends Component {
      map = new TrackedMap([['foo', 456]]);

      get value() {
        return this.map.get('foo');
      }

      update() {
        this.map.set('foo', 123);
      }
    }
  );

  reactivityTest(
    'get/set unrelated value',
    class extends Component {
      map = new TrackedMap([['foo', 456]]);

      get value() {
        return this.map.get('foo');
      }

      update() {
        this.map.set('bar', 123);
      }
    },
    false
  );

  reactivityTest(
    'has',
    class extends Component {
      map = new TrackedMap();

      get value() {
        return this.map.has('foo');
      }

      update() {
        this.map.set('foo', 123);
      }
    }
  );

  reactivityTest(
    'entries',
    class extends Component {
      map = new TrackedMap();

      get value() {
        return this.map.entries();
      }

      update() {
        this.map.set('foo', 123);
      }
    }
  );

  reactivityTest(
    'keys',
    class extends Component {
      map = new TrackedMap();

      get value() {
        return this.map.keys();
      }

      update() {
        this.map.set('foo', 123);
      }
    }
  );

  reactivityTest(
    'values',
    class extends Component {
      map = new TrackedMap();

      get value() {
        return this.map.values();
      }

      update() {
        this.map.set('foo', 123);
      }
    }
  );

  reactivityTest(
    'forEach',
    class extends Component {
      map = new TrackedMap();

      get value() {
        this.map.forEach(() => {
          /* no op! */
        });
        return 'test';
      }

      update() {
        this.map.set('foo', 123);
      }
    }
  );

  reactivityTest(
    'size',
    class extends Component {
      map = new TrackedMap();

      get value() {
        return this.map.size;
      }

      update() {
        this.map.set('foo', 123);
      }
    }
  );

  reactivityTest(
    'delete',
    class extends Component {
      map = new TrackedMap([['foo', 123]]);

      get value() {
        return this.map.get('foo');
      }

      update() {
        this.map.delete('foo');
      }
    }
  );

  reactivityTest(
    'delete unrelated value',
    class extends Component {
      map = new TrackedMap([
        ['foo', 123],
        ['bar', 456],
      ]);

      get value() {
        return this.map.get('foo');
      }

      update() {
        this.map.delete('bar');
      }
    },
    false
  );

  reactivityTest(
    'clear',
    class extends Component {
      map = new TrackedMap([['foo', 123]]);

      get value() {
        return this.map.get('foo');
      }

      update() {
        this.map.clear();
      }
    }
  );

  eachReactivityTest(
    'set',
    class extends Component {
      collection = new TrackedMap([['foo', 123]]);
      update() {
        this.collection.set('bar', 456);
      }
    }
  );
  eachReactivityTest(
    'set existing value',
    class extends Component {
      collection = new TrackedMap([['foo', 123]]);
      update() {
        this.collection.set('foo', 789);
      }
    }
  );

  eachInReactivityTest(
    'set',
    class extends Component {
      collection = new TrackedMap([['foo', 123]]);

      update() {
        this.collection.set('bar', 456);
      }
    }
  );

  eachInReactivityTest(
    'set existing value',
    class extends Component {
      collection = new TrackedMap([['foo', 123]]);

      update() {
        this.collection.set('foo', 789);
      }
    }
  );
});
