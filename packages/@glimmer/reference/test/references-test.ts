import { type GlobalContext, testOverrideGlobalContext } from '@glimmer/global-context';
import {
  Accessor,
  createDebugAliasRef,
  DeeplyConstant,
  FallibleFormula,
  getReactiveProperty,
  isAccessor,
  isUpdatableRef,
  MutableCell,
  ReadonlyCell,
  type SomeReactive,
  toMut,
  toReadonly,
  unwrapReactive,
  updateRef,
} from '@glimmer/reference';
import { dict, unwrap } from '@glimmer/util';
import { consumeTag, createTag, dirtyTag } from '@glimmer/validator';

import { tracked } from './support';

const { module, test, todo } = QUnit;

class TrackedDict<T> {
  private tag = createTag();
  private data = dict<T>();

  get(key: string): T {
    consumeTag(this.tag);
    return unwrap(this.data[key]);
  }

  set(key: string, value: T) {
    dirtyTag(this.tag);
    return (this.data[key] = value);
  }
}

module('References', (hooks) => {
  let originalContext: GlobalContext | null;
  let getCount = 0;
  let setCount = 0;

  hooks.beforeEach(() => {
    originalContext = unwrap(testOverrideGlobalContext)({
      getProp(obj: object, key: string): unknown {
        getCount++;
        return (obj as Record<string, unknown>)[key];
      },

      setProp(obj: object, key: string, value: unknown) {
        setCount++;
        (obj as Record<string, unknown>)[key] = value;
      },

      scheduleRevalidate() {},
    });
  });

  hooks.afterEach(() => {
    unwrap(testOverrideGlobalContext)(originalContext);
  });

  hooks.beforeEach(() => {
    getCount = 0;
    setCount = 0;
  });

  class Validatable<T> {
    readonly #reactive: SomeReactive<T>;

    constructor(reactive: SomeReactive<T>) {
      this.#reactive = reactive;
    }

    token(): {
      fresh: () => void;
      stale: (value: T, message?: string) => void;
      updated: (value: T, message?: string) => void;
    } {
      let lastGetCount = getCount;
      let lastSetCount = setCount;
      let lastValue = unwrapReactive(this.#reactive);
      return {
        fresh: () => {
          const actual = unwrapReactive(this.#reactive);

          if (actual === lastValue && getCount === lastGetCount) {
            QUnit.assert.ok(true, `fresh: the reactive value hasn't changed`);
            lastValue = actual;
            this.#noop(actual);
          } else {
            if (actual !== lastValue && getCount !== lastGetCount) {
              QUnit.assert.ok(false, `fresh: the reactive value is not fresh`);
            } else {
              QUnit.assert.strictEqual(
                actual,
                lastValue,
                `fresh: the reactive value hasn't changed`
              );
              QUnit.assert.strictEqual(getCount, lastGetCount, `fresh: the counter hasn't changed`);
            }

            lastGetCount = getCount;
            lastSetCount = setCount;
          }
        },
        updated: (value: T, message?: string) => {
          const actual = unwrapReactive(this.#reactive);

          if (getCount !== lastGetCount && lastSetCount === setCount + 1) {
            QUnit.assert.strictEqual(
              actual,
              value,
              `updated: ${message ?? 'the new reactive value'}`
            );
          } else {
            QUnit.assert.deepEqual(
              { get: getCount, set: setCount },
              { get: lastGetCount + 1, set: lastSetCount + 1 },
              `stale: ${message} (get and set were called)`
            );
            lastValue = actual;
            this.#noop(actual);
          }

          lastGetCount = getCount;
          lastSetCount = setCount;
        },
        stale: (value: T, message?: string) => {
          const actual = unwrapReactive(this.#reactive);

          if (getCount !== lastGetCount && lastSetCount === setCount) {
            QUnit.assert.strictEqual(
              actual,
              value,
              `stale: ${message ?? 'the new reactive value'}`
            );
            lastValue = actual;
            this.#noop(actual);
          } else {
            QUnit.assert.deepEqual(
              { get: getCount, set: setCount },
              { get: lastGetCount + 1, set: lastSetCount },
              `stale: ${message} (get was called, but set was not)`
            );
          }

          lastGetCount = getCount;
          lastSetCount = setCount;
        },
      };
    }

    #noop(lastValue: T) {
      const lastGetCount = getCount;
      const lastSetCount = setCount;

      const value = unwrapReactive(this.#reactive);

      if (value === lastValue && getCount === lastGetCount && setCount === lastSetCount) {
        return;
      } else {
        QUnit.assert.deepEqual(
          { get: getCount, set: setCount },
          { get: lastGetCount, set: lastSetCount },
          `Expected a second read to the reactive value to make 0 calls and 0 sets`
        );
      }
    }
  }

  module('const ref', () => {
    test('it works', (assert) => {
      let value = {};
      let constRef = ReadonlyCell(value, 'test');

      assert.strictEqual(unwrapReactive(constRef), value, 'value is correct');
      assert.notOk(isUpdatableRef(constRef), 'value is not updatable');
    });

    test('can create children of const refs', (assert) => {
      class Parent {
        @tracked child = 123;
      }

      let parent = new Parent();

      let constRef = ReadonlyCell(parent, 'test');
      let childRef = getReactiveProperty(constRef, 'child');
      const validChild = new Validatable(childRef).token();

      assert.strictEqual(unwrapReactive(childRef), 123, 'value is correct');
      assert.strictEqual(unwrapReactive(childRef), 123, 'value is correct');
      assert.strictEqual(getCount, 1, 'get called correct number of times');

      parent.child = 456;
      validChild.stale(456, 'value updated correctly');

      assert.true(isUpdatableRef(childRef), 'childRef is updatable');

      updateRef(childRef, 789);
      validChild.updated(789, 'value updated correctly');
    });
  });

  module('compute ref', () => {
    test('compute reference caches computation', (assert) => {
      let count = 0;

      let dict = new TrackedDict<string>();
      let ref = FallibleFormula(() => {
        count++;
        return dict.get('foo');
      });

      dict.set('foo', 'bar');

      assert.strictEqual(count, 0, 'precond');

      assert.strictEqual(unwrapReactive(ref), 'bar');
      assert.strictEqual(unwrapReactive(ref), 'bar');
      assert.strictEqual(unwrapReactive(ref), 'bar');

      assert.strictEqual(count, 1, 'computed');

      dict.set('foo', 'BAR');

      assert.strictEqual(unwrapReactive(ref), 'BAR');
      assert.strictEqual(unwrapReactive(ref), 'BAR');
      assert.strictEqual(unwrapReactive(ref), 'BAR');

      assert.strictEqual(count, 2, 'computed');

      dict.set('baz', 'bat');

      assert.strictEqual(unwrapReactive(ref), 'BAR');
      assert.strictEqual(unwrapReactive(ref), 'BAR');
      assert.strictEqual(unwrapReactive(ref), 'BAR');

      assert.strictEqual(count, 3, 'computed');

      dict.set('foo', 'bar');

      assert.strictEqual(unwrapReactive(ref), 'bar');
      assert.strictEqual(unwrapReactive(ref), 'bar');
      assert.strictEqual(unwrapReactive(ref), 'bar');

      assert.strictEqual(count, 4, 'computed');
    });

    test('compute refs cache nested computation correctly', (assert) => {
      let count = 0;

      let first = new TrackedDict<string>();
      let second = new TrackedDict<string>();

      let innerRef = FallibleFormula(() => {
        count++;
        return first.get('foo');
      });
      let outerRef = FallibleFormula(() => unwrapReactive(innerRef));

      first.set('foo', 'bar');

      assert.strictEqual(count, 0, 'precond');

      assert.strictEqual(unwrapReactive(outerRef), 'bar');
      assert.strictEqual(unwrapReactive(outerRef), 'bar');
      assert.strictEqual(unwrapReactive(outerRef), 'bar');

      assert.strictEqual(count, 1, 'computed');

      second.set('foo', 'BAR');

      assert.strictEqual(unwrapReactive(outerRef), 'bar');
      assert.strictEqual(unwrapReactive(outerRef), 'bar');
      assert.strictEqual(unwrapReactive(outerRef), 'bar');

      assert.strictEqual(count, 1, 'computed');

      first.set('foo', 'BAR');

      assert.strictEqual(unwrapReactive(outerRef), 'BAR');
      assert.strictEqual(unwrapReactive(outerRef), 'BAR');
      assert.strictEqual(unwrapReactive(outerRef), 'BAR');

      assert.strictEqual(count, 2, 'computed');
    });

    test('can create children of compute refs', (assert) => {
      class Child {
        @tracked value = 123;
      }

      class Parent {
        @tracked child = new Child();
      }

      let parent = new Parent();

      let computeRef = FallibleFormula(() => parent.child);
      let valueRef = getReactiveProperty(computeRef, 'value');

      assert.strictEqual(unwrapReactive(valueRef), 123, 'value is correct');
      assert.strictEqual(unwrapReactive(valueRef), 123, 'value is correct');
      assert.strictEqual(getCount, 1, 'get called correct number of times');

      parent.child.value = 456;

      assert.strictEqual(unwrapReactive(valueRef), 456, 'value updated correctly');
      assert.strictEqual(unwrapReactive(valueRef), 456, 'value is correct');
      assert.strictEqual(getCount, 2, 'get called correct number of times');

      assert.true(isUpdatableRef(valueRef), 'childRef is updatable');

      updateRef(valueRef, 789);

      assert.strictEqual(unwrapReactive(valueRef), 789, 'value updated correctly');
      assert.strictEqual(getCount, 3, 'get called correct number of times');
      assert.strictEqual(setCount, 1, 'set called correct number of times');

      parent.child = new Child();

      assert.strictEqual(
        unwrapReactive(valueRef),
        123,
        'value updated correctly when parent changes'
      );
      assert.strictEqual(getCount, 4, 'get called correct number of times');
    });
  });

  module('deeply constant', () => {
    test('it works', (assert) => {
      let value = {};
      let constRef = DeeplyConstant(value, 'test');

      assert.strictEqual(unwrapReactive(constRef), value, 'value is correct');
      assert.notOk(isUpdatableRef(constRef), 'value is not updatable');
    });

    test('children of deeply constant values are deeply constant', (assert) => {
      class Parent {
        @tracked child = 123;
      }

      let parent = new Parent();

      let constRef = DeeplyConstant(parent, 'test');
      let childRef = getReactiveProperty(constRef, 'child');

      assert.strictEqual(unwrapReactive(childRef), 123, 'value is correct');

      parent.child = 456;

      assert.strictEqual(unwrapReactive(childRef), 123, 'value updated correctly');
    });
  });

  module('accessor', () => {
    test('can create accessors', (assert) => {
      // let ref = FallibleFormula(() => {});

      let accessor = Accessor({
        get: () => {},
        set: () => {},
      });

      assert.ok(isAccessor(accessor));
    });

    test('can create children of invokable refs', (assert) => {
      class Child {
        @tracked value = 123;
      }

      class Parent {
        @tracked child = new Child();
      }

      let parent = new Parent();

      let invokableRef = Accessor({
        get: () => parent.child,
        set: (value: Child) => (parent.child = value),
      });
      // let invokableRef = formulaToAccessor(computeRef);
      let valueRef = getReactiveProperty(invokableRef, 'value');

      assert.strictEqual(unwrapReactive(valueRef), 123, 'value is correct');
      assert.strictEqual(unwrapReactive(valueRef), 123, 'value is correct');
      assert.strictEqual(getCount, 1, 'get called correct number of times');

      parent.child.value = 456;

      assert.strictEqual(unwrapReactive(valueRef), 456, 'value updated correctly');
      assert.strictEqual(unwrapReactive(valueRef), 456, 'value is correct');
      assert.strictEqual(getCount, 2, 'get called correct number of times');

      assert.true(isUpdatableRef(valueRef), 'childRef is updatable');

      updateRef(valueRef, 789);

      assert.strictEqual(unwrapReactive(valueRef), 789, 'value updated correctly');
      assert.strictEqual(getCount, 3, 'get called correct number of times');
      assert.strictEqual(setCount, 1, 'set called correct number of times');

      parent.child = new Child();

      assert.strictEqual(
        unwrapReactive(valueRef),
        123,
        'value updated correctly when parent changes'
      );
      assert.strictEqual(getCount, 4, 'get called correct number of times');
    });
  });

  module('mut ref', () => {
    test('can convert a readonly ref to mut', (assert) => {
      const ref = ReadonlyCell(123);
      const mutable = toMut(ref);
      assert.notOk(isUpdatableRef(ref), 'original ref is not updatable');

      assert.ok(isUpdatableRef(mutable), 'mutable ref is updatable');
    });

    test("can mutate a mut ref's value", (assert) => {
      const ref = MutableCell(123);
      const mutable = toMut(ref);

      updateRef(mutable, 456);
      assert.strictEqual(unwrapReactive(mutable), 456, 'mut wrapper was updated');
      assert.strictEqual(unwrapReactive(ref), 456, 'original reactive was updated');
    });
  });

  module('read only ref', () => {
    test('can convert an updatable ref to read only', (assert) => {
      class Parent {
        @tracked child = 123;
      }

      let parent = new Parent();

      let computeRef = Accessor({
        get: () => parent.child,
        set: (value: number) => (parent.child = value),
      });

      let readOnlyRef = toReadonly(computeRef);

      assert.ok(isUpdatableRef(computeRef), 'original ref is updatable');
      assert.notOk(isUpdatableRef(readOnlyRef), 'read only ref is not updatable');
    });

    test('can create children of read only refs', (assert) => {
      class Child {
        @tracked value = 123;
      }

      class Parent {
        @tracked child = new Child();
      }

      let parent = new Parent();

      let computeRef = Accessor({
        get: () => parent.child,
        set: (value: Child) => (parent.child = value),
      });
      let readOnlyRef = toReadonly(computeRef);
      let valueRef = getReactiveProperty(readOnlyRef, 'value');

      assert.strictEqual(unwrapReactive(valueRef), 123, 'value is correct');
      assert.strictEqual(unwrapReactive(valueRef), 123, 'value is correct');
      assert.strictEqual(getCount, 1, 'get called correct number of times');

      parent.child.value = 456;

      assert.strictEqual(unwrapReactive(valueRef), 456, 'value updated correctly');
      assert.strictEqual(unwrapReactive(valueRef), 456, 'value is correct');
      assert.strictEqual(getCount, 2, 'get called correct number of times');

      assert.true(isUpdatableRef(valueRef), 'childRef is updatable');

      updateRef(valueRef, 789);

      assert.strictEqual(unwrapReactive(valueRef), 789, 'value updated correctly');
      assert.strictEqual(getCount, 3, 'get called correct number of times');
      assert.strictEqual(setCount, 1, 'set called correct number of times');

      parent.child = new Child();

      assert.strictEqual(
        unwrapReactive(valueRef),
        123,
        'value updated correctly when parent changes'
      );
      assert.strictEqual(getCount, 4, 'get called correct number of times');
    });
  });

  if (import.meta.env.DEV) {
    module('debugAliasRef', () => {
      test('debug alias refs are transparent', (assert) => {
        class Foo {
          @tracked value = 123;
        }

        let foo = new Foo();

        let original = Accessor({
          get: () => foo.value,
          set: (newValue) => (foo.value = newValue),
        });

        let alias = unwrap(createDebugAliasRef)('@test', original);

        assert.strictEqual(unwrapReactive(original), 123, 'alias returns correct value');
        assert.strictEqual(unwrapReactive(alias), 123, 'alias returns correct value');
        assert.ok(isUpdatableRef(alias), 'alias is updatable');

        updateRef(alias, 456);

        assert.strictEqual(unwrapReactive(original), 456, 'alias returns correct value');
        assert.strictEqual(unwrapReactive(alias), 456, 'alias returns correct value');

        let readOnly = toReadonly(original);
        let readOnlyAlias = unwrap(createDebugAliasRef)('@test', readOnly);

        assert.strictEqual(unwrapReactive(readOnly), 456, 'alias returns correct value');
        assert.strictEqual(unwrapReactive(readOnlyAlias), 456, 'alias returns correct value');
        assert.notOk(isUpdatableRef(readOnly), 'alias is not updatable');

        let invokableAlias = unwrap(createDebugAliasRef)('@test', original);

        assert.ok(isAccessor(invokableAlias), 'alias is invokable');
      });
    });
  }
});
