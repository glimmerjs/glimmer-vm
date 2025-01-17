import { getChangedProperties, getTrackedDependencies, trackedData } from '@glimmer/validator';

import { module, test } from './-utils';

module('@glimmer/validator: tracked-utils', () => {
  class TestObject {
    declare item1: string;
    declare item2: string;
    item3 = '';
    constructor() {}

    get getterWithTracked() {
      return this.item1 + ' world' + this.item2;
    }
  }

  {
    const { getter, setter } = trackedData<TestObject, 'item1'>('item1', () => '');
    Object.defineProperty(TestObject.prototype, 'item1', {
      enumerable: true,
      get(this) {
        return getter(this);
      },
      set(this, v) {
        return setter(this, v);
      },
    });
  }
  {
    const { getter, setter } = trackedData<TestObject, 'item2'>('item2', () => '');
    Object.defineProperty(TestObject.prototype, 'item2', {
      enumerable: true,
      get(this) {
        return getter(this);
      },
      set(this, v) {
        return setter(this, v);
      },
    });
  }

  test('it can detect changed properties', (assert) => {
    const obj = new TestObject();
    let trackedInfo = getChangedProperties(obj);
    assert.deepEqual(trackedInfo?.changed, []);

    obj.item1 = 'hello';

    assert.deepEqual(getChangedProperties(obj, trackedInfo)?.changed, ['item1']);
    assert.deepEqual(getChangedProperties(obj, trackedInfo)?.changed, []);

    obj.item1 = 'hi';
    obj.item2 = 'hi';
    assert.deepEqual(getChangedProperties(obj, trackedInfo)?.changed, ['item1', 'item2']);
  });

  test('it can detect tracked dependencies', (assert) => {
    const obj = new TestObject();
    let info = getTrackedDependencies(obj, 'getterWithTracked');
    assert.deepEqual(info.dependencies, [
      {
        changed: false,
        object: obj,
        propertyKey: 'item1',
      },
      {
        changed: false,
        object: obj,
        propertyKey: 'item2',
      },
    ]);

    obj.item1 = 'hi';
    assert.deepEqual(getTrackedDependencies(obj, 'getterWithTracked', info).dependencies, [
      {
        changed: true,
        object: obj,
        propertyKey: 'item1',
      },
      {
        changed: false,
        object: obj,
        propertyKey: 'item2',
      },
    ]);
    assert.deepEqual(getTrackedDependencies(obj, 'getterWithTracked', info).dependencies, [
      {
        changed: false,
        object: obj,
        propertyKey: 'item1',
      },
      {
        changed: false,
        object: obj,
        propertyKey: 'item2',
      },
    ]);
  });
});
