import {
  assertDestroyablesDestroyed,
  associateDestroyableChild,
  destroy,
  destroyChildren,
  enableDestroyableTracking,
  isDestroyed,
  isDestroying,
  registerDestructor,
  unregisterDestructor,
} from '@glimmer/destroyable';
import { type GlobalContext, testOverrideGlobalContext } from '@glimmer/global-context';
import { unwrap } from '@glimmer/util';

const { module, test } = QUnit;

let destroyQueue: (() => void)[] = [];
let destroyedQueue: (() => void)[] = [];

function flush() {
  for (let fn of destroyQueue) fn();
  for (let fn of destroyedQueue) fn();

  destroyQueue = [];
  destroyedQueue = [];
}

module('Destroyables', (hooks) => {
  let originalContext: GlobalContext | null;

  hooks.beforeEach(() => {
    originalContext = unwrap(
      testOverrideGlobalContext?.({
        scheduleDestroy<T extends object>(destroyable: T, destructor: (value: T) => void) {
          destroyQueue.push(() => destructor(destroyable));
        },

        scheduleDestroyed(fn: () => void) {
          destroyedQueue.push(fn);
        },
      })
    );
  });

  hooks.afterEach(() => {
    unwrap(testOverrideGlobalContext)(originalContext);
  });

  hooks.afterEach((assert) => {
    assert.strictEqual(destroyQueue.length, 0, 'destruction flushed');
  });

  test('standard destructors work', (assert) => {
    let destroyable = {};
    let count = 0;

    registerDestructor(destroyable, () => count++);

    assert.false(isDestroying(destroyable), 'not destroying at first');
    assert.false(isDestroyed(destroyable), 'not destroyed at first');

    destroy(destroyable);

    assert.true(isDestroying(destroyable), 'destroying immediately after destroy() called');
    assert.false(isDestroyed(destroyable), 'not destroyed immediately after destroy()');
    assert.strictEqual(count, 0, 'count has not increased');

    flush();

    assert.true(isDestroying(destroyable), 'still destroying after flush');
    assert.true(isDestroyed(destroyable), 'destroyed after flush');
    assert.strictEqual(count, 1, 'destructor was run');
  });

  test('destructors work with functions', (assert) => {
    let count = 0;

    registerDestructor(noop, () => count++);

    assert.false(isDestroying(noop), 'not destroying at first');
    assert.false(isDestroyed(noop), 'not destroyed at first');

    destroy(noop);

    assert.true(isDestroying(noop), 'destroying immediately after destroy() called');
    assert.false(isDestroyed(noop), 'not destroyed immediately after destroy()');
    assert.strictEqual(count, 0, 'count has not increased');

    flush();

    assert.true(isDestroying(noop), 'still destroying after flush');
    assert.true(isDestroyed(noop), 'destroyed after flush');
    assert.strictEqual(count, 1, 'destructor was run');
  });

  test('can register multiple destructors', (assert) => {
    let destroyable = {};
    let count = 0;

    registerDestructor(destroyable, () => count++);
    registerDestructor(destroyable, () => count++);

    assert.false(isDestroying(destroyable), 'not destroying at first');
    assert.false(isDestroyed(destroyable), 'not destroyed at first');

    destroy(destroyable);

    assert.true(isDestroying(destroyable), 'destroying immediately after destroy() called');
    assert.false(isDestroyed(destroyable), 'not destroyed immediately after destroy()');
    assert.strictEqual(count, 0, 'count has not increased');

    flush();

    assert.true(isDestroying(destroyable), 'still destroying after flush');
    assert.true(isDestroyed(destroyable), 'destroyed after flush');
    assert.strictEqual(count, 2, 'both destructors were run');
  });

  test('destruction only happens once', (assert) => {
    let destroyable = {};
    let count = 0;

    registerDestructor(destroyable, () => count++);

    destroy(destroyable);
    flush();

    assert.true(isDestroying(destroyable), 'destroying after flush');
    assert.true(isDestroyed(destroyable), 'destroyed after flush');
    assert.strictEqual(count, 1, 'destructor was run');

    destroy(destroyable);
    flush();

    assert.true(isDestroying(destroyable), 'destroying after second flush');
    assert.true(isDestroyed(destroyable), 'destroyed after second flush');
    assert.strictEqual(count, 1, 'destructor was not run again');
  });

  test('eager destructors work', (assert) => {
    let destroyable = {};
    let count = 0;

    registerDestructor(destroyable, () => count++, true);

    destroy(destroyable);

    assert.true(isDestroying(destroyable), 'destroying immediately after destroy() called');
    assert.false(isDestroyed(destroyable), 'not destroyed immediately after destroy()');
    assert.strictEqual(count, 1, 'count has increased, eager destructor run');

    flush();

    assert.true(isDestroying(destroyable), 'destroying after flush');
    assert.true(isDestroyed(destroyable), 'destroyed after flush');
    assert.strictEqual(count, 1, 'destructor was not run again');
  });

  test('can unregister a destructor', (assert) => {
    let destroyable = {};
    let count = 0;

    let destructor = registerDestructor(destroyable, () => count++);
    unregisterDestructor(destroyable, destructor);

    destroy(destroyable);
    flush();

    assert.strictEqual(count, 0, 'destructor was not called');
  });

  test('can associate destroyable children', (assert) => {
    let parent = {};
    let child = {};

    associateDestroyableChild(parent, child);
    registerDestructor(parent, () => assert.action('parent'));
    registerDestructor(child, () => assert.action('child'));

    assert.false(isDestroying(parent), 'parent not destroying at first');
    assert.false(isDestroyed(parent), 'parent not destroyed at first');

    assert.false(isDestroying(child), 'child not destroying at first');
    assert.false(isDestroyed(child), 'child not destroyed at first');

    destroy(parent);

    assert.true(isDestroying(parent), 'parent destroying immediately after destroy() called');
    assert.false(isDestroyed(parent), 'parent not destroyed immediately after destroy()');

    assert.true(isDestroying(child), 'child destroying immediately after destroy() called');
    assert.false(isDestroyed(child), 'child not destroyed immediately after destroy()');

    assert.verifyActions([], 'nothing destroyed yet');

    assert.step('flush');

    flush();

    assert.true(isDestroying(parent), 'parent still destroying after flush');
    assert.true(isDestroyed(parent), 'parent destroyed after flush');

    assert.true(isDestroying(child), 'child still destroying after flush');
    assert.true(isDestroyed(child), 'child destroyed after flush');

    assert.verifyActions(['child', 'parent'], 'destructors run in correct order');
  });

  test('destroying child before a parent works', (assert) => {
    let parent = {};
    let child = {};

    associateDestroyableChild(parent, child);
    registerDestructor(parent, () => assert.action('parent'));
    registerDestructor(child, () => assert.action('child'));

    assert.false(isDestroying(parent), 'parent not destroying at first');
    assert.false(isDestroyed(parent), 'parent not destroyed at first');

    assert.false(isDestroying(child), 'child not destroying at first');
    assert.false(isDestroyed(child), 'child not destroyed at first');

    destroy(child);

    assert.false(isDestroying(parent), 'parent not immediately after child destroy()');
    assert.false(isDestroyed(parent), 'parent not destroyed after child destroy()');

    assert.true(isDestroying(child), 'child destroying immediately after destroy()');
    assert.false(isDestroyed(child), 'child not destroyed immediately after destroy() called');

    assert.verifyActions([], 'nothing destroyed yet');
    flush();

    assert.false(isDestroying(parent), 'parent still not destroying after flush');
    assert.false(isDestroyed(parent), 'parent not destroyed after flush');

    assert.true(isDestroying(child), 'child still destroying after flush');
    assert.true(isDestroyed(child), 'child destroyed after flush');

    assert.verifyActions(['child'], 'child destructor run');
    destroy(parent);

    assert.true(isDestroying(parent), 'parent destroying after destroy()');
    assert.false(isDestroyed(parent), 'parent not destroyed before flush');

    flush();

    assert.true(isDestroying(parent), 'parent still destroying after flush');
    assert.true(isDestroyed(parent), 'parent destroyed after flush');

    assert.verifyActions(['parent'], 'parent destructor run');
  });

  test('children can have multiple parents, but only destroy once', (assert) => {
    let parent1 = {};
    let parent2 = {};
    let child = {};

    associateDestroyableChild(parent1, child);
    associateDestroyableChild(parent2, child);

    registerDestructor(parent1, () => assert.action('parent1'));
    registerDestructor(parent2, () => assert.action('parent2'));
    registerDestructor(child, () => assert.action('child'));

    destroy(parent1);
    flush();

    assert.true(isDestroying(parent1), 'parent1 destroying');
    assert.true(isDestroyed(parent1), 'parent1 destroyed');

    assert.false(isDestroying(parent2), 'parent2 not destroying');
    assert.false(isDestroyed(parent2), 'parent2 not destroyed');

    assert.true(isDestroying(child), 'child destroying');
    assert.true(isDestroyed(child), 'child destroyed');

    assert.verifyActions(['child', 'parent1'], 'first parent and child destroyed');

    destroy(parent2);
    flush();

    assert.true(isDestroying(parent1), 'parent1 destroying');
    assert.true(isDestroyed(parent1), 'parent1 destroyed');

    assert.true(isDestroying(parent2), 'parent2 destroying');
    assert.true(isDestroyed(parent2), 'parent2 destroyed');

    assert.true(isDestroying(child), 'child destroying');
    assert.true(isDestroyed(child), 'child destroyed');

    assert.verifyActions(['parent2'], 'second parent destroyed');
  });

  test('can destroy children with the destroyChildren API', (assert) => {
    let parent = {};
    let child = {};

    associateDestroyableChild(parent, child);
    registerDestructor(parent, () => assert.action('parent'));
    registerDestructor(child, () => assert.action('child'));

    assert.false(isDestroying(parent), 'parent not destroying at first');
    assert.false(isDestroyed(parent), 'parent not destroyed at first');

    assert.false(isDestroying(child), 'child not destroying at first');
    assert.false(isDestroyed(child), 'child not destroyed at first');

    destroyChildren(parent);

    assert.false(isDestroying(parent), 'parent not immediately after child destroy()');
    assert.false(isDestroyed(parent), 'parent not destroyed after child destroy()');

    assert.true(isDestroying(child), 'child destroying immediately after destroy()');
    assert.false(isDestroyed(child), 'child not destroyed immediately after destroy() called');

    assert.verifyActions([], 'nothing destroyed yet');

    flush();

    assert.false(isDestroying(parent), 'parent still not destroying after flush');
    assert.false(isDestroyed(parent), 'parent not destroyed after flush');

    assert.true(isDestroying(child), 'child still destroying after flush');
    assert.true(isDestroyed(child), 'child destroyed after flush');

    assert.verifyActions(['child'], 'child destructor called');

    destroy(parent);

    assert.true(isDestroying(parent), 'parent destroying after destroy()');
    assert.false(isDestroyed(parent), 'parent not destroyed before flush');

    flush();

    assert.true(isDestroying(parent), 'parent still destroying after flush');
    assert.true(isDestroyed(parent), 'parent destroyed after flush');

    assert.verifyActions(['parent'], 'parent destructor called');
  });

  test('destroyables are destroying during destruction but not destroyed', (assert) => {
    let parent = {};
    let child = {};

    associateDestroyableChild(parent, child);

    registerDestructor(parent, () => {
      assert.action('parent destructor');

      assert.ok(isDestroying(parent), 'parent is destroying');
      assert.ok(isDestroying(child), 'child is destroying');

      assert.notOk(isDestroyed(parent), 'parent is not destroyed');
      assert.notOk(isDestroyed(child), 'child is not destroyed');
    });

    registerDestructor(child, () => {
      assert.action('child destructor');
      assert.ok(isDestroying(parent), 'parent is destroying');
      assert.ok(isDestroying(child), 'child is destroying');

      assert.notOk(isDestroyed(parent), 'parent is not destroyed');
      assert.notOk(isDestroyed(child), 'child is not destroyed');
    });

    destroy(parent);
    flush();

    assert.verifyActions(['child destructor', 'parent destructor'], 'destructors run bottom up');
  });

  test('destroyables are passed the correct object when destroying', (assert) => {
    let parent = {};
    let child = {};

    associateDestroyableChild(parent, child);
    registerDestructor(parent, (_parent) => {
      assert.action('parent destructor');
      assert.strictEqual(parent, _parent, 'passed the correct value');
    });
    registerDestructor(child, (_child) => {
      assert.action('child destructor');
      assert.strictEqual(child, _child, 'passed the correct value');
    });

    destroy(parent);
    flush();

    assert.verifyActions(['child destructor', 'parent destructor'], 'destructors run bottom up');
  });

  if (import.meta.env.DEV) {
    test('attempting to unregister a destructor that was not registered throws an error', (assert) => {
      assert.throws(() => {
        unregisterDestructor({}, () => 123);
      }, /attempted to remove a destructor that was not registered with the destroyable/u);
    });

    test('attempting to register a destructor on an object that isDestroying throws an error', (assert) => {
      assert.throws(() => {
        let destroyable = {};
        destroy(destroyable);
        registerDestructor(destroyable, () => 123);
      }, /Attempted to register a destructor with an object that is already destroying or destroyed/u);
    });

    test('attempting to unregister a destructor on an object that isDestroying throws an error', (assert) => {
      assert.throws(() => {
        let destroyable = {};
        destroy(destroyable);
        unregisterDestructor(destroyable, () => 123);
      }, /Attempted to unregister a destructor with an object that is already destroying or destroyed/u);
    });

    test('can track destroyables during tests and assert if they were not destroyed', (assert) => {
      assert.throws(() => {
        unwrap(enableDestroyableTracking)();

        registerDestructor({}, () => {});

        unwrap(assertDestroyablesDestroyed)();
      }, /Some destroyables were not destroyed during this test:/u);
    });

    test('assertion does not throw if destroyables were destroyed', () => {
      unwrap(enableDestroyableTracking)();

      let object = {};
      registerDestructor(object, () => {});
      destroy(object);
      flush();

      unwrap(assertDestroyablesDestroyed)();
    });

    test('checking isDestroying does not trigger assertion', () => {
      unwrap(enableDestroyableTracking)();

      let object = {};

      isDestroying(object);

      unwrap(assertDestroyablesDestroyed)();
    });

    test('checking isDestroyed does not trigger assertion', () => {
      unwrap(enableDestroyableTracking)();

      let object = {};

      isDestroyed(object);

      unwrap(assertDestroyablesDestroyed)();
    });

    test('error thrown attaches destroyables for helpful debugging', (assert) => {
      unwrap(enableDestroyableTracking)();

      let object1 = {};
      registerDestructor(object1, () => {});

      let object2 = {};
      registerDestructor(object2, () => {});

      try {
        unwrap(assertDestroyablesDestroyed)();
      } catch (error) {
        assert.action('catch handler');
        assert.deepEqual(
          (error as { destroyables: unknown[] }).destroyables,
          [object1, object2],
          'destroyables property'
        );
      }

      assert.verifyActions(['catch handler']);
    });

    test('attempting to call assertDestroyablesDestroyed() before calling enableDestroyableTracking() throws', (assert) => {
      assert.throws(() => {
        unwrap(assertDestroyablesDestroyed)();
      }, /Attempted to assert destroyables destroyed, but you did not start a destroyable test. Did you forget to call `enableDestroyableTracking\(\)`/u);
    });

    test('attempting to call enabledDestroyableTracking() twice before calling assertDestroyablesDestroyed throws', (assert) => {
      assert.throws(() => {
        unwrap(enableDestroyableTracking)();
        unwrap(enableDestroyableTracking)();
      }, /Attempted to start destroyable testing, but you did not end the previous destroyable test. Did you forget to call `assertDestroyablesDestroyed\(\)`/u);
    });
  }
});

function noop() {
  // noop
}
