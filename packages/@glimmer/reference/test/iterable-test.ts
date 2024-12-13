import type { GlobalContextOverride } from '@glimmer/global-context';
import type { OpaqueIterationItem, Reference } from '@glimmer/reference';
import type { Cache } from '@glimmer/validator';
import { bump, consumeTag } from '@glimmer/fundamental';
import { testOverrideGlobalContext } from '@glimmer/global-context';
import { createComputeRef, createIteratorRef, valueForRef } from '@glimmer/reference';
import { createCache, CURRENT_TAG, getValue } from '@glimmer/validator';

import objectValues from './utils/platform';
import { module, test } from './utils/qunit';
import { TestContext } from './utils/template';

class IterableWrapper {
  private iterable: Reference<{ next(): OpaqueIterationItem | null }>;
  private iterateCache: Cache<OpaqueIterationItem[]>;

  constructor(obj: unknown, key = '@identity') {
    let valueRef = createComputeRef(() => {
      consumeTag(CURRENT_TAG);
      return obj;
    });
    this.iterable = createIteratorRef(valueRef, key);

    this.iterateCache = createCache(() => this.iterate());
  }

  private iterate(): OpaqueIterationItem[] {
    let result: OpaqueIterationItem[] = [];

    // bootstrap
    let iterator = valueForRef(this.iterable);
    let item = iterator.next();

    while (item !== null) {
      result.push(item);
      item = iterator.next();
    }

    return result;
  }

  toValues() {
    return getValue(this.iterateCache)!.map((i) => i.value);
  }

  toKeys() {
    return getValue(this.iterateCache)!.map((i) => i.key);
  }
}

module('@glimmer/reference: IterableReference', (hooks) => {
  let override: GlobalContextOverride;

  hooks.beforeEach(() => {
    override = testOverrideGlobalContext(TestContext);
  });

  hooks.afterEach(() => {
    override.done();
  });

  module('iterator delegates', () => {
    test('it correctly iterates delegates', (assert) => {
      let obj = { a: 'Yehuda', b: 'Godfrey' };
      let target = new IterableWrapper(obj);

      assert.deepEqual(target.toValues(), objectValues(obj));
    });

    test('it correctly synchronizes delegates when changed', (assert) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let obj = { a: 'Yehuda', b: 'Godfrey' } as any;
      let target = new IterableWrapper(obj);

      assert.deepEqual(target.toValues(), objectValues(obj));

      obj.c = 'Rob';
      bump();

      assert.deepEqual(target.toValues(), objectValues(obj));

      obj.a = 'Godhuda';
      bump();

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
      let arr = [
        { key: 'a', name: 'Yehuda' },
        { key: 'b', name: 'Godfrey' },
      ];
      let target = new IterableWrapper(arr);

      assert.deepEqual(target.toKeys(), arr);
    });

    test('@identity works with multiple values that are the same', (assert) => {
      let yehuda = { key: 'a', name: 'Yehuda' };
      let godfrey = { key: 'b', name: 'Godfrey' };
      let arr = [yehuda, godfrey, godfrey];

      let target = new IterableWrapper(arr);

      let keys1 = target.toKeys();

      assert.strictEqual(keys1.length, 3);
      assert.strictEqual(keys1[0], yehuda);
      assert.strictEqual(keys1[1], godfrey);

      arr.pop();
      arr.unshift(godfrey);
      bump();

      let keys2 = target.toKeys();

      assert.strictEqual(keys2.length, 3);
      assert.strictEqual(keys2[0], godfrey);
      assert.strictEqual(keys2[1], yehuda);

      // Test that a unique key was created and is used consistently
      assert.strictEqual(keys1[2], keys2[2]);
    });

    test('@identity works with primitives (except null)', (assert) => {
      let arr = [undefined, 123, 'foo', Symbol('bar'), true];
      let target = new IterableWrapper(arr);

      assert.deepEqual(target.toValues(), arr);
      assert.deepEqual(target.toKeys(), arr);
    });

    test('@identity works with null', (assert) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let arr: any[] = [null];
      let target = new IterableWrapper(arr);

      let keys1 = target.toKeys();

      arr.unshift(undefined);
      bump();

      let keys2 = target.toKeys();

      assert.strictEqual(keys1[0], keys2[1]);
    });

    test('@identity works with multiple null values', (assert) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let arr: any[] = [null];
      let target = new IterableWrapper(arr);

      let keys1 = target.toKeys();

      arr.push(null);
      bump();

      let keys2 = target.toKeys();

      assert.strictEqual(keys2.length, 2);
      assert.strictEqual(keys1[0], keys2[0]);
      assert.notEqual(keys1[0], keys2[1]);
    });

    test('@key works', (assert) => {
      let arr = [
        { key: 'a', name: 'Yehuda' },
        { key: 'b', name: 'Godfrey' },
      ];
      let target = new IterableWrapper(arr, '@key');

      assert.deepEqual(target.toKeys(), [0, 1]);
    });

    test('@index works', (assert) => {
      let arr = [
        { key: 'a', name: 'Yehuda' },
        { key: 'b', name: 'Godfrey' },
      ];
      let target = new IterableWrapper(arr, '@index');

      assert.deepEqual(target.toKeys(), ['0', '1']);
    });

    test('paths work', (assert) => {
      let arr = [
        { key: 'a', name: 'Yehuda' },
        { key: 'b', name: 'Godfrey' },
      ];
      let target = new IterableWrapper(arr, 'key');

      assert.deepEqual(target.toKeys(), ['a', 'b']);
    });

    test('it works with dictionaries', (assert) => {
      let arr = [Object.create(null), Object.create(null)];
      let target = new IterableWrapper(arr);

      assert.deepEqual(target.toValues(), arr);
      assert.deepEqual(target.toKeys(), arr);
    });
  });
});
