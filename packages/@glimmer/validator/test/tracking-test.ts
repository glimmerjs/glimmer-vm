import { module, test } from './-utils';

import { DEBUG } from '@glimmer/env';

import {
  // deprecateMutationsInTrackingTransaction,
  isTracking,
  // runInTrackingTransaction,
  // tracked,
  untrack,
  createCache,
  createStorage,
  isConst,
  getValue,
  setValue,
} from '..';

module('@glimmer/validator: tracking', () => {
  module('basics', () => {
    test('it memoizes based on tags that are consumed within a track frame', (assert) => {
      let storage1 = createStorage(false);
      let storage2 = createStorage(false);
      let count = 0;

      let cache = createCache(() => {
        getValue(storage1);
        getValue(storage2);

        return ++count;
      });

      assert.equal(getValue(cache), 1, 'called correctly the first time');
      assert.equal(getValue(cache), 1, 'memoized result returned second time');

      setValue(storage1, true);
      assert.equal(getValue(cache), 2, 'cache busted when storage1 dirtied');
      assert.equal(getValue(cache), 2, 'memoized result returned when nothing dirtied');

      setValue(storage2, true);
      assert.equal(getValue(cache), 3, 'cache busted when storage2 dirtied');
      assert.equal(getValue(cache), 3, 'memoized result returned when nothing dirtied');
    });

    test('it ignores tags consumed within an untrack frame', (assert) => {
      let storage1 = createStorage(false);
      let storage2 = createStorage(false);
      let count = 0;

      let cache = createCache(() => {
        getValue(storage1);

        untrack(() => getValue(storage2));

        return ++count;
      });

      assert.equal(getValue(cache), 1, 'called correctly the first time');
      assert.equal(getValue(cache), 1, 'memoized result returned second time');

      setValue(storage1, true);
      assert.equal(getValue(cache), 2, 'cache busted when storage1 dirtied');
      assert.equal(getValue(cache), 2, 'memoized result returned when nothing dirtied');

      setValue(storage2, true);
      assert.equal(getValue(cache), 2, 'cache not busted when storage2 dirtied');
    });

    test('nested memoizations work, and automatically propogate', (assert) => {
      let innerStorage = createStorage(false);
      let outerStorage = createStorage(false);

      let innerCount = 0;
      let outerCount = 0;

      let innerCache = createCache(() => {
        getValue(innerStorage);

        return ++innerCount;
      });

      let outerCache = createCache(() => {
        getValue(outerStorage);

        return [++outerCount, getValue(innerCache)];
      });

      assert.deepEqual(
        getValue(outerCache),
        [1, 1],
        'both functions called correctly the first time'
      );
      assert.deepEqual(getValue(outerCache), [1, 1], 'memoized result returned correctly');

      setValue(outerStorage, true);

      assert.deepEqual(
        getValue(outerCache),
        [2, 1],
        'outer result updated, inner result still memoized'
      );
      assert.deepEqual(getValue(outerCache), [2, 1], 'memoized result returned correctly');

      setValue(innerStorage, true);

      assert.deepEqual(getValue(outerCache), [3, 2], 'both inner and outer result updated');
      assert.deepEqual(getValue(outerCache), [3, 2], 'memoized result returned correctly');
    });

    test('isTracking works within a memoized function and untrack frame', (assert) => {
      assert.expect(3);
      assert.notOk(isTracking());

      let cache = createCache(() => {
        assert.ok(isTracking());

        untrack(() => {
          assert.notOk(isTracking());
        });
      });

      getValue(cache);
    });

    test('isConst allows users to check if a memoized function is constant', (assert) => {
      let tag = createStorage(false);

      let constCache = createCache(() => {
        // do nothing;
      });

      let nonConstCache = createCache(() => {
        getValue(tag);
      });

      getValue(constCache);
      getValue(nonConstCache);

      assert.ok(isConst(constCache), 'constant cache returns true');
      assert.notOk(isConst(nonConstCache), 'non-constant cache returns false');
    });

    test('isConst returns false when used on a brand new cache', (assert) => {
      let cache = createCache(() => {
        // do nothing;
      });

      assert.equal(isConst(cache), false, 'Cache is not constant when first created.');

      getValue(cache);

      assert.equal(isConst(cache), true, 'Cache becomes constant once evaluated.');
    });

    if (DEBUG) {
      test('createCache throws an error in DEBUG mode if users to use with a non-function', (assert) => {
        assert.throws(
          () => createCache(123 as any),
          /Error: createCache\(\) must be passed a function as its first parameter. Called with: 123/
        );
      });

      test('getValue throws an error in DEBUG mode if users to use with a non-cache', (assert) => {
        assert.throws(
          () => getValue(123 as any),
          /Error: getValue\(\) can only be used on an instance of a cache created with createCache\(\) or a storage created with createStorage\(\). Called with: 123/
        );
      });

      test('isConst throws an error in DEBUG mode if users attempt to use with a non-cache', (assert) => {
        assert.throws(
          () => isConst(123 as any),
          /Error: isConst\(\) can only be used on an instance of a cache created with createCache\(\) or a storage created with createStorage\(\). Called with: 123/
        );
      });
    }
  });

  // if (DEBUG) {
  //   module('debug', () => {
  //     test('it errors when attempting to update a value that has already been consumed in the same transaction', (assert) => {
  //       let tag = createStorage(false);

  //       assert.throws(() => {
  //         runInTrackingTransaction!(() => {
  //           track(() => {
  //             getValue(tag);
  //             dirtyTag(tag);
  //           });
  //         });
  //       }, /Error: You attempted to update `\(an unknown tag\)`/);
  //     });

  //     test('it throws errors across track frames within the same debug transaction', (assert) => {
  //       let tag = createStorage(false);

  //       assert.throws(() => {
  //         runInTrackingTransaction!(() => {
  //           track(() => {
  //             getValue(tag);
  //           });

  //           track(() => {
  //             dirtyTag(tag);
  //           });
  //         });
  //       }, /Error: You attempted to update `\(an unknown tag\)`/);
  //     });

  //     test('it ignores untrack for consumption', (assert) => {
  //       assert.expect(0);
  //       let tag = createStorage(false);

  //       runInTrackingTransaction!(() => {
  //         untrack(() => {
  //           getValue(tag);
  //         });

  //         track(() => {
  //           dirtyTag(tag);
  //         });
  //       });
  //     });

  //     test('it does not ignore untrack for dirty', (assert) => {
  //       let tag = createStorage(false);

  //       assert.throws(() => {
  //         runInTrackingTransaction!(() => {
  //           track(() => {
  //             getValue(tag);
  //           });

  //           untrack(() => {
  //             dirtyTag(tag);
  //           });
  //         });
  //       }, /Error: You attempted to update `\(an unknown tag\)`/);
  //     });

  //     test('it can switch to warnings/deprecations', (assert) => {
  //       let tag = createStorage(false);

  //       runInTrackingTransaction!(() => {
  //         track(() => {
  //           deprecateMutationsInTrackingTransaction!(() => {
  //             getValue(tag);
  //             dirtyTag(tag);
  //           });
  //         });
  //       });

  //       assert.validateDeprecations(
  //         /You attempted to update `.*`, but it had already been used previously in the same computation./
  //       );
  //     });

  //     test('it switches back to errors with nested track calls', (assert) => {
  //       let tag = createStorage(false);

  //       assert.throws(() => {
  //         runInTrackingTransaction!(() => {
  //           deprecateMutationsInTrackingTransaction!(() => {
  //             track(() => {
  //               getValue(tag);
  //               dirtyTag(tag);
  //             });
  //           });
  //         });
  //       }, /Error: You attempted to update `\(an unknown tag\)`/);
  //     });

  //     test('it gets a better error message with tagFor', (assert) => {
  //       class Foo {}
  //       let foo = new Foo();

  //       assert.throws(() => {
  //         runInTrackingTransaction!(() => {
  //           deprecateMutationsInTrackingTransaction!(() => {
  //             track(() => {
  //               getValue(tagFor(foo, 'bar'));
  //               dirtyTagFor(foo, 'bar');
  //             });
  //           });
  //         });
  //       }, /Error: You attempted to update `bar` on `\(an instance of .*\)`/);
  //     });
  //   });
  // }
});
