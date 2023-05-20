import { type GlobalContext, testOverrideGlobalContext } from '@glimmer/global-context';
import {
  createComputeRef,
  createIteratorRef,
  type OpaqueIterationItem,
  type Reference,
  valueForRef,
} from '@glimmer/reference';
import { consumeTag, VOLATILE_TAG } from '@glimmer/validator';

import objectValues from './utils/platform';
import { module, test } from './utils/qunit';
import { TestContext } from './utils/template';
import { unwrap } from '@glimmer/util';

class IterableWrapper {
  readonly #iterable: Reference<{ _next_(): OpaqueIterationItem | null }>;

  constructor(obj: unknown, key = '@identity') {
    let valueReference = createComputeRef(() => {
      consumeTag(VOLATILE_TAG);
      return obj;
    });
    this.#iterable = createIteratorRef(valueReference, key);
  }

  #iterate() {
    let result: OpaqueIterationItem[] = [];

    // bootstrap
    let iterator = valueForRef(this.#iterable);
    let item = iterator._next_();

    while (item !== null) {
      result.push(item);
      item = iterator._next_();
    }

    return result;
  }

  toValues() {
    return this.#iterate().map((index) => index.value);
  }

  toKeys() {
    return this.#iterate().map((index) => index.key);
  }
}

module('@glimmer/reference: IterableReference', (hooks) => {
  let originalContext: GlobalContext | null;

  hooks.beforeEach(() => {
    originalContext = unwrap(testOverrideGlobalContext)(TestContext);
  });

  hooks.afterEach(() => {
    unwrap(testOverrideGlobalContext)(originalContext);
  });

  module('iterator delegates', () => {
    test('it correctly iterates delegates', (assert) => {
      let obj = { a: 'Yehuda', b: 'Godfrey' };
      let target = new IterableWrapper(obj);

      assert.deepEqual(target.toValues(), objectValues(obj));
    });

    test('it correctly synchronizes delegates when changed', (assert) => {
      let obj = { a: 'Yehuda', b: 'Godfrey' } as any;
      let target = new IterableWrapper(obj);

      assert.deepEqual(target.toValues(), objectValues(obj));

      obj.c = 'Rob';

      assert.deepEqual(target.toValues(), objectValues(obj));

      obj.a = 'Godhuda';

      assert.deepEqual(target.toValues(), objectValues(obj));
    });

    test('it handles null delegates', (assert) => {
      // Passing null will return an empty iterator
      let target = new IterableWrapper(null);

      assert.deepEqual(target.toValues(), []);
    });
  });

  module('keys', () => {
    test('@identity works', (assert) => {
      let array = [
        { key: 'a', name: 'Yehuda' },
        { key: 'b', name: 'Godfrey' },
      ];
      let target = new IterableWrapper(array);

      assert.deepEqual(target.toKeys(), array);
    });

    test('@identity works with multiple values that are the same', (assert) => {
      let yehuda = { key: 'a', name: 'Yehuda' };
      let godfrey = { key: 'b', name: 'Godfrey' };
      let array = [yehuda, godfrey, godfrey];

      let target = new IterableWrapper(array);

      let keys1 = target.toKeys();

      assert.strictEqual(keys1.length, 3);
      assert.strictEqual(keys1[0], yehuda);
      assert.strictEqual(keys1[1], godfrey);

      array.pop();
      array.unshift(godfrey);

      let keys2 = target.toKeys();

      assert.strictEqual(keys2.length, 3);
      assert.strictEqual(keys2[0], godfrey);
      assert.strictEqual(keys2[1], yehuda);

      // Test that a unique key was created and is used consistently
      assert.strictEqual(keys1[2], keys2[2]);
    });

    test('@identity works with primitives (except null)', (assert) => {
      let array = [undefined, 123, 'foo', Symbol('bar'), true];
      let target = new IterableWrapper(array);

      assert.deepEqual(target.toValues(), array);
      assert.deepEqual(target.toKeys(), array);
    });

    test('@identity works with null', (assert) => {
      let array: any[] = [null];
      let target = new IterableWrapper(array);

      let keys1 = target.toKeys();

      array.unshift(undefined);

      let keys2 = target.toKeys();

      assert.strictEqual(keys1[0], keys2[1]);
    });

    test('@identity works with multiple null values', (assert) => {
      let array: any[] = [null];
      let target = new IterableWrapper(array);

      let keys1 = target.toKeys();

      array.push(null);

      let keys2 = target.toKeys();

      assert.strictEqual(keys2.length, 2);
      assert.strictEqual(keys1[0], keys2[0]);
      assert.notEqual(keys1[0], keys2[1]);
    });

    test('@key works', (assert) => {
      let array = [
        { key: 'a', name: 'Yehuda' },
        { key: 'b', name: 'Godfrey' },
      ];
      let target = new IterableWrapper(array, '@key');

      assert.deepEqual(target.toKeys(), [0, 1]);
    });

    test('@index works', (assert) => {
      let array = [
        { key: 'a', name: 'Yehuda' },
        { key: 'b', name: 'Godfrey' },
      ];
      let target = new IterableWrapper(array, '@index');

      assert.deepEqual(target.toKeys(), ['0', '1']);
    });

    test('paths work', (assert) => {
      let array = [
        { key: 'a', name: 'Yehuda' },
        { key: 'b', name: 'Godfrey' },
      ];
      let target = new IterableWrapper(array, 'key');

      assert.deepEqual(target.toKeys(), ['a', 'b']);
    });

    test('it works with dictionaries', (assert) => {
      let array = [Object.create(null), Object.create(null)];
      let target = new IterableWrapper(array);

      assert.deepEqual(target.toValues(), array);
      assert.deepEqual(target.toKeys(), array);
    });
  });
});
