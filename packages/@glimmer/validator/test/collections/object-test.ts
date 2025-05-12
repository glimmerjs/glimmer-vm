import type { TestContext } from '@ember/test-helpers';
import { render, settled } from '@ember/test-helpers';
import Component from '@glimmer/component';
import { hbs } from 'ember-cli-htmlbars';
import { setupRenderingTest } from 'ember-qunit';
import { expectTypeOf } from 'expect-type';
import { module, test } from 'qunit';
import { TrackedObject } from 'tracked-built-ins';

import { eachInReactivityTest } from '../helpers/collection-reactivity';
import { reactivityTest } from '../helpers/reactivity';

// The whole point here is that Object *is* the thing we are matching, ESLint!
// eslint-disable-next-line @typescript-eslint/ban-types
expectTypeOf<TrackedObject>().toMatchTypeOf<object>();

// @ts-expect-error - Required keys should require a value
let a = new TrackedObject<{ foo: number }>();
// @ts-expect-error - Required keys should require a value
new TrackedObject<{ foo: number }>({});

// Optional keys should not require a value
new TrackedObject<{ foo?: number }>();

module('TrackedObject', function (hooks) {
  setupRenderingTest(hooks);

  test('basic usage', (assert) => {
    let original = { foo: 123 };
    let obj = new TrackedObject(original);

    assert.ok(obj instanceof TrackedObject);
    expectTypeOf(obj).toEqualTypeOf<{ foo: number }>();
    assert.deepEqual(Object.keys(obj), ['foo']);
    assert.equal(obj.foo, 123);

    obj.foo = 456;
    assert.equal(obj.foo, 456, 'object updated correctly');
    assert.equal(original.foo, 123, 'original object was not updated');
  });

  test('preserves getters', (assert) => {
    let obj = new TrackedObject({
      foo: 123,
      get bar(): number {
        return this.foo;
      },
    });

    expectTypeOf(obj).toEqualTypeOf<{ foo: number; readonly bar: number }>();

    obj.foo = 456;
    assert.equal(obj.foo, 456, 'object updated correctly');
    assert.equal(obj.bar, 456, 'getter cloned correctly');
  });

  test('fromEntries', (assert) => {
    const entries = Object.entries({ foo: 123 });
    let obj = TrackedObject.fromEntries(entries);
    // We will lose the specific key, becuase `Object.entries` does not preserve
    // it, but the type produced by `TrackedObject.fromEntries` should match the
    // type produced by `Object.fromEntries`.
    let underlying = Object.fromEntries(entries);
    expectTypeOf(obj).toEqualTypeOf(underlying);

    assert.ok(obj instanceof TrackedObject);
    assert.deepEqual(Object.keys(obj), ['foo']);
  });

  test('it works when used directly in a template', async function (this: TestContext & {
    obj: Record<PropertyKey, unknown>;
  }, assert) {
    this.obj = new TrackedObject<Record<PropertyKey, unknown>>({ foo: 123 });

    await render(hbs`{{this.obj.foo}}`);

    assert.dom().hasText('123');

    this.obj['foo'] = 456;
    await settled();

    assert.dom().hasText('456');
  });

  eachInReactivityTest(
    '{{each-in}} works with new items',
    class extends Component {
      collection = new TrackedObject<Record<string, number>>({
        foo: 123,
      });

      update() {
        this.collection['bar'] = 456;
      }
    }
  );

  eachInReactivityTest(
    '{{each-in}} works when updating old items',
    class extends Component {
      collection = new TrackedObject({
        foo: 123,
      });

      update() {
        this.collection.foo = 456;
      }
    }
  );

  reactivityTest(
    'it works',
    class extends Component {
      obj = new TrackedObject();

      get value() {
        return this.obj['foo'];
      }

      update() {
        this.obj['foo'] = 123;
      }
    }
  );

  reactivityTest(
    'in operator works',
    class extends Component {
      obj = new TrackedObject();

      get value() {
        return 'foo' in this.obj;
      }

      update() {
        this.obj['foo'] = 123;
      }
    }
  );

  reactivityTest(
    'for in works',
    class extends Component {
      obj = new TrackedObject();

      get value() {
        let keys = [];

        for (let key in this.obj) {
          keys.push(key);
        }

        return keys;
      }

      update() {
        this.obj['foo'] = 123;
      }
    }
  );

  reactivityTest(
    'Object.keys works',
    class extends Component {
      obj = new TrackedObject();

      get value() {
        return Object.keys(this.obj);
      }

      update() {
        this.obj['foo'] = 123;
      }
    }
  );

  reactivityTest(
    'delete works',
    class extends Component {
      obj: { foo?: number } = new TrackedObject({ foo: 1 });

      get value() {
        return this.obj.foo;
      }

      update() {
        delete this.obj.foo;
      }
    }
  );
});
