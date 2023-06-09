import { type GlobalContext, testOverrideGlobalContext } from '@glimmer/global-context';
import { dict, unwrap } from '@glimmer/util';
import { consumeTag, createTag, dirtyTag } from '@glimmer/validator';

import {
  childRefFor,
  createComputeRef,
  createConstRef,
  createDebugAliasRef,
  createInvokableRef,
  createReadOnlyRef,
  createUnboundRef,
  isInvokableRef,
  isUpdatableRef,
  updateRef,
  valueForRef,
} from '@glimmer/reference';
import { tracked } from '@glimmer-workspace/integration-tests';

const { module, test } = QUnit;

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

  module('const ref', () => {
    test('it works', (assert) => {
      let value = {};
      let constReference = createConstRef(value, 'test');

      assert.strictEqual(valueForRef(constReference), value, 'value is correct');
      assert.notOk(isUpdatableRef(constReference), 'value is not updatable');
    });

    test('can create children of const refs', (assert) => {
      class Parent {
        @tracked accessor child = 123;
      }

      let parent = new Parent();

      let constReference = createConstRef(parent, 'test');
      let childReference = childRefFor(constReference, 'child');

      assert.strictEqual(valueForRef(childReference), 123, 'value is correct');
      assert.strictEqual(valueForRef(childReference), 123, 'value is correct');
      assert.strictEqual(getCount, 1, 'get called correct number of times');

      parent.child = 456;

      assert.strictEqual(valueForRef(childReference), 456, 'value updated correctly');
      assert.strictEqual(valueForRef(childReference), 456, 'value is correct');
      assert.strictEqual(getCount, 2, 'get called correct number of times');

      assert.true(isUpdatableRef(childReference), 'childRef is updatable');

      updateRef(childReference, 789);

      assert.strictEqual(valueForRef(childReference), 789, 'value updated correctly');
      assert.strictEqual(getCount, 3, 'get called correct number of times');
      assert.strictEqual(setCount, 1, 'set called correct number of times');
    });
  });

  module('compute ref', () => {
    test('compute reference caches computation', (assert) => {
      let count = 0;

      let dict = new TrackedDict<string>();
      let reference = createComputeRef(() => {
        count++;
        return dict.get('foo');
      });

      dict.set('foo', 'bar');

      assert.strictEqual(count, 0, 'precond');

      assert.strictEqual(valueForRef(reference), 'bar');
      assert.strictEqual(valueForRef(reference), 'bar');
      assert.strictEqual(valueForRef(reference), 'bar');

      assert.strictEqual(count, 1, 'computed');

      dict.set('foo', 'BAR');

      assert.strictEqual(valueForRef(reference), 'BAR');
      assert.strictEqual(valueForRef(reference), 'BAR');
      assert.strictEqual(valueForRef(reference), 'BAR');

      assert.strictEqual(count, 2, 'computed');

      dict.set('baz', 'bat');

      assert.strictEqual(valueForRef(reference), 'BAR');
      assert.strictEqual(valueForRef(reference), 'BAR');
      assert.strictEqual(valueForRef(reference), 'BAR');

      assert.strictEqual(count, 3, 'computed');

      dict.set('foo', 'bar');

      assert.strictEqual(valueForRef(reference), 'bar');
      assert.strictEqual(valueForRef(reference), 'bar');
      assert.strictEqual(valueForRef(reference), 'bar');

      assert.strictEqual(count, 4, 'computed');
    });

    test('compute refs cache nested computation correctly', (assert) => {
      let count = 0;

      let first = new TrackedDict<string>();
      let second = new TrackedDict<string>();

      let innerReference = createComputeRef(() => {
        count++;
        return first.get('foo');
      });
      let outerReference = createComputeRef(() => valueForRef(innerReference));

      first.set('foo', 'bar');

      assert.strictEqual(count, 0, 'precond');

      assert.strictEqual(valueForRef(outerReference), 'bar');
      assert.strictEqual(valueForRef(outerReference), 'bar');
      assert.strictEqual(valueForRef(outerReference), 'bar');

      assert.strictEqual(count, 1, 'computed');

      second.set('foo', 'BAR');

      assert.strictEqual(valueForRef(outerReference), 'bar');
      assert.strictEqual(valueForRef(outerReference), 'bar');
      assert.strictEqual(valueForRef(outerReference), 'bar');

      assert.strictEqual(count, 1, 'computed');

      first.set('foo', 'BAR');

      assert.strictEqual(valueForRef(outerReference), 'BAR');
      assert.strictEqual(valueForRef(outerReference), 'BAR');
      assert.strictEqual(valueForRef(outerReference), 'BAR');

      assert.strictEqual(count, 2, 'computed');
    });

    test('can create children of compute refs', (assert) => {
      class Child {
        @tracked accessor value = 123;
      }

      class Parent {
        @tracked accessor child = new Child();
      }

      let parent = new Parent();

      let computeReference = createComputeRef(() => parent.child);
      let valueReference = childRefFor(computeReference, 'value');

      assert.strictEqual(valueForRef(valueReference), 123, 'value is correct');
      assert.strictEqual(valueForRef(valueReference), 123, 'value is correct');
      assert.strictEqual(getCount, 1, 'get called correct number of times');

      parent.child.value = 456;

      assert.strictEqual(valueForRef(valueReference), 456, 'value updated correctly');
      assert.strictEqual(valueForRef(valueReference), 456, 'value is correct');
      assert.strictEqual(getCount, 2, 'get called correct number of times');

      assert.true(isUpdatableRef(valueReference), 'childRef is updatable');

      updateRef(valueReference, 789);

      assert.strictEqual(valueForRef(valueReference), 789, 'value updated correctly');
      assert.strictEqual(getCount, 3, 'get called correct number of times');
      assert.strictEqual(setCount, 1, 'set called correct number of times');

      parent.child = new Child();

      assert.strictEqual(
        valueForRef(valueReference),
        123,
        'value updated correctly when parent changes'
      );
      assert.strictEqual(getCount, 4, 'get called correct number of times');
    });
  });

  module('unbound ref', () => {
    test('it works', (assert) => {
      let value = {};
      let constReference = createUnboundRef(value, 'test');

      assert.strictEqual(valueForRef(constReference), value, 'value is correct');
      assert.notOk(isUpdatableRef(constReference), 'value is not updatable');
    });

    test('children of unbound refs are not reactive', (assert) => {
      class Parent {
        @tracked accessor child = 123;
      }

      let parent = new Parent();

      let constReference = createUnboundRef(parent, 'test');
      let childReference = childRefFor(constReference, 'child');

      assert.strictEqual(valueForRef(childReference), 123, 'value is correct');

      parent.child = 456;

      assert.strictEqual(valueForRef(childReference), 123, 'value updated correctly');
    });
  });

  module('invokable ref', () => {
    test('can create invokable refs', (assert) => {
      let reference = createComputeRef(
        () => {},
        () => {}
      );

      let invokableReference = createInvokableRef(reference);

      assert.ok(isInvokableRef(invokableReference));
    });

    test('can create children of invokable refs', (assert) => {
      class Child {
        @tracked accessor value = 123;
      }

      class Parent {
        @tracked accessor child = new Child();
      }

      let parent = new Parent();

      let computeReference = createComputeRef(
        () => parent.child,
        (value) => (parent.child = value)
      );
      let invokableReference = createInvokableRef(computeReference);
      let valueReference = childRefFor(invokableReference, 'value');

      assert.strictEqual(valueForRef(valueReference), 123, 'value is correct');
      assert.strictEqual(valueForRef(valueReference), 123, 'value is correct');
      assert.strictEqual(getCount, 1, 'get called correct number of times');

      parent.child.value = 456;

      assert.strictEqual(valueForRef(valueReference), 456, 'value updated correctly');
      assert.strictEqual(valueForRef(valueReference), 456, 'value is correct');
      assert.strictEqual(getCount, 2, 'get called correct number of times');

      assert.true(isUpdatableRef(valueReference), 'childRef is updatable');

      updateRef(valueReference, 789);

      assert.strictEqual(valueForRef(valueReference), 789, 'value updated correctly');
      assert.strictEqual(getCount, 3, 'get called correct number of times');
      assert.strictEqual(setCount, 1, 'set called correct number of times');

      parent.child = new Child();

      assert.strictEqual(
        valueForRef(valueReference),
        123,
        'value updated correctly when parent changes'
      );
      assert.strictEqual(getCount, 4, 'get called correct number of times');
    });
  });

  module('read only ref', () => {
    test('can convert an updatable ref to read only', (assert) => {
      class Parent {
        @tracked accessor child = 123;
      }

      let parent = new Parent();

      let computeReference = createComputeRef(
        () => parent.child,
        (value) => (parent.child = value)
      );

      let readOnlyReference = createReadOnlyRef(computeReference);

      assert.ok(isUpdatableRef(computeReference), 'original ref is updatable');
      assert.notOk(isUpdatableRef(readOnlyReference), 'read only ref is not updatable');
    });

    test('can create children of read only refs', (assert) => {
      class Child {
        @tracked accessor value = 123;
      }

      class Parent {
        @tracked accessor child = new Child();
      }

      let parent = new Parent();

      let computeReference = createComputeRef(
        () => parent.child,
        (value) => (parent.child = value)
      );
      let readOnlyReference = createReadOnlyRef(computeReference);
      let valueReference = childRefFor(readOnlyReference, 'value');

      assert.strictEqual(valueForRef(valueReference), 123, 'value is correct');
      assert.strictEqual(valueForRef(valueReference), 123, 'value is correct');
      assert.strictEqual(getCount, 1, 'get called correct number of times');

      parent.child.value = 456;

      assert.strictEqual(valueForRef(valueReference), 456, 'value updated correctly');
      assert.strictEqual(valueForRef(valueReference), 456, 'value is correct');
      assert.strictEqual(getCount, 2, 'get called correct number of times');

      assert.true(isUpdatableRef(valueReference), 'childRef is updatable');

      updateRef(valueReference, 789);

      assert.strictEqual(valueForRef(valueReference), 789, 'value updated correctly');
      assert.strictEqual(getCount, 3, 'get called correct number of times');
      assert.strictEqual(setCount, 1, 'set called correct number of times');

      parent.child = new Child();

      assert.strictEqual(
        valueForRef(valueReference),
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
          @tracked accessor value = 123;
        }

        let foo = new Foo();

        let original = createComputeRef(
          () => foo.value,
          (newValue) => (foo.value = newValue)
        );

        let alias = unwrap(createDebugAliasRef)('@test', original);

        assert.strictEqual(valueForRef(original), 123, 'alias returns correct value');
        assert.strictEqual(valueForRef(alias), 123, 'alias returns correct value');
        assert.ok(isUpdatableRef(alias), 'alias is updatable');

        updateRef(alias, 456);

        assert.strictEqual(valueForRef(original), 456, 'alias returns correct value');
        assert.strictEqual(valueForRef(alias), 456, 'alias returns correct value');

        let readOnly = createReadOnlyRef(original);
        let readOnlyAlias = unwrap(createDebugAliasRef)('@test', readOnly);

        assert.strictEqual(valueForRef(readOnly), 456, 'alias returns correct value');
        assert.strictEqual(valueForRef(readOnlyAlias), 456, 'alias returns correct value');
        assert.notOk(isUpdatableRef(readOnly), 'alias is not updatable');

        let invokable = createInvokableRef(original);
        let invokableAlias = unwrap(createDebugAliasRef)('@test', invokable);

        assert.ok(isInvokableRef(invokableAlias), 'alias is invokable');
      });
    });
  }
});
