import {
  beginTrackFrame,
  consumeTag,
  debug,
  dirtyTag,
  endTrackFrame,
  isTracking,
  validateTag,
  valueForTag,
} from '@glimmer/fundamental';

import { createTag, module, test, track, trackedData, untrack } from './-utils';

module('@glimmer/fundamental: tracking', () => {
  module('track', () => {
    test('it combines tags that are consumed within a track frame', (assert) => {
      let tag1 = createTag();
      let tag2 = createTag();

      let combined = track(() => {
        consumeTag(tag1);
        consumeTag(tag2);
      });

      let snapshot = valueForTag(combined);
      dirtyTag(tag1);
      assert.notOk(validateTag(combined, snapshot));

      snapshot = valueForTag(combined);
      dirtyTag(tag2);
      assert.notOk(validateTag(combined, snapshot));
    });

    test('it ignores tags consumed within an untrack frame', (assert) => {
      let tag1 = createTag();
      let tag2 = createTag();

      let combined = track(() => {
        consumeTag(tag1);

        untrack(() => {
          consumeTag(tag2);
        });
      });

      let snapshot = valueForTag(combined);
      dirtyTag(tag1);
      assert.notOk(validateTag(combined, snapshot));

      snapshot = valueForTag(combined);
      dirtyTag(tag2);
      assert.ok(validateTag(combined, snapshot));
    });

    test('it does not automatically consume tags in nested tracking frames', (assert) => {
      let tag1 = createTag();
      let tag2 = createTag();

      let combined = track(() => {
        consumeTag(tag1);

        track(() => {
          consumeTag(tag2);
        });
      });

      let snapshot = valueForTag(combined);
      dirtyTag(tag1);
      assert.notOk(validateTag(combined, snapshot));

      snapshot = valueForTag(combined);
      dirtyTag(tag2);
      assert.ok(validateTag(combined, snapshot));
    });

    test('it works for nested tags', (assert) => {
      let tag1 = createTag();
      let tag2 = createTag();

      let combined = track(() => {
        consumeTag(tag1);

        let tag3 = track(() => {
          consumeTag(tag2);
        });

        consumeTag(tag3);
      });

      let snapshot = valueForTag(combined);
      dirtyTag(tag1);
      assert.notOk(validateTag(combined, snapshot));

      snapshot = valueForTag(combined);
      dirtyTag(tag2);
      assert.notOk(validateTag(combined, snapshot));
    });

    test('isTracking works within a track and untrack frame', (assert) => {
      assert.notOk(isTracking());

      track(() => {
        assert.step('track');
        assert.ok(isTracking());

        untrack(() => {
          assert.step('untrack');
          assert.notOk(isTracking());
        });
      });

      assert.verifySteps(['track', 'untrack']);
    });

    test('nested tracks work', (assert) => {
      assert.notOk(isTracking());

      track(() => {
        assert.step('track');
        assert.ok(isTracking());

        untrack(() => {
          assert.step('untrack');
          assert.notOk(isTracking());
        });
      });

      assert.verifySteps(['track', 'untrack']);
    });

    test('nested tracks and untracks work', (assert) => {
      track(() => {
        track(() => {
          untrack(() => {
            track(() => {
              assert.step('supernested');
              assert.ok(isTracking(), 'tracking');
            });
          });
        });
      });

      assert.verifySteps(['supernested']);
    });
  });

  module('manual track frames', () => {
    test('it combines tags that are consumed within a track frame', (assert) => {
      let tag1 = createTag();
      let tag2 = createTag();

      beginTrackFrame();

      consumeTag(tag1);
      consumeTag(tag2);

      let combined = endTrackFrame();

      let snapshot = valueForTag(combined);
      dirtyTag(tag1);
      assert.notOk(validateTag(combined, snapshot));

      snapshot = valueForTag(combined);
      dirtyTag(tag2);
      assert.notOk(validateTag(combined, snapshot));
    });

    test('it ignores tags consumed within an untrack frame', (assert) => {
      let tag1 = createTag();
      let tag2 = createTag();

      beginTrackFrame();

      consumeTag(tag1);

      untrack(() => {
        consumeTag(tag2);
      });

      let combined = endTrackFrame();

      let snapshot = valueForTag(combined);
      dirtyTag(tag1);
      assert.notOk(validateTag(combined, snapshot));

      snapshot = valueForTag(combined);
      dirtyTag(tag2);
      assert.ok(validateTag(combined, snapshot));
    });

    test('it does not automatically consume tags in nested tracking frames', (assert) => {
      let tag1 = createTag();
      let tag2 = createTag();

      beginTrackFrame();

      consumeTag(tag1);

      // begin inner track frame
      beginTrackFrame();

      consumeTag(tag2);

      // end inner track frame
      endTrackFrame();

      let combined = endTrackFrame();

      let snapshot = valueForTag(combined);
      dirtyTag(tag1);
      assert.notOk(validateTag(combined, snapshot));

      snapshot = valueForTag(combined);
      dirtyTag(tag2);
      assert.ok(validateTag(combined, snapshot));
    });

    test('it works for nested tags', (assert) => {
      let tag1 = createTag();
      let tag2 = createTag();

      beginTrackFrame();

      consumeTag(tag1);

      // begin inner track frame
      beginTrackFrame();

      consumeTag(tag2);

      // end inner track frame
      let tag3 = endTrackFrame();

      consumeTag(tag3);

      let combined = endTrackFrame();

      let snapshot = valueForTag(combined);
      dirtyTag(tag1);
      assert.notOk(validateTag(combined, snapshot));

      snapshot = valueForTag(combined);
      dirtyTag(tag2);
      assert.notOk(validateTag(combined, snapshot));
    });

    test('isTracking works within a track', (assert) => {
      assert.notOk(isTracking());

      beginTrackFrame();

      assert.ok(isTracking());

      endTrackFrame();
    });

    test('asserts if track frame was ended without one existing', (assert) => {
      assert.throws(
        () => endTrackFrame(),
        /attempted to close a tracking frame, but one was not open/u
      );
    });
  });

  module('trackedData', () => {
    test('it creates a storage cell that can be accessed and updated', (assert) => {
      class Foo {
        foo = 123;
      }

      let { getter, setter } = trackedData<Foo, keyof Foo>('foo');

      let foo = new Foo();

      setter(foo, 456);
      assert.strictEqual(getter(foo), 456, 'value is set correctly');
      assert.strictEqual(foo.foo, 123, 'value is not set on the actual object');
    });

    test('it can receive an initializer', (assert) => {
      class Foo {
        foo = 123;
        bar = 456;
      }

      let { getter } = trackedData<Foo, keyof Foo>('foo', (self: Foo) => self.bar);

      let foo = new Foo();

      assert.strictEqual(getter(foo), 456, 'value is initialized correctly');
      assert.strictEqual(foo.foo, 123, 'value is not set on the actual object');
    });

    test('it tracks changes to the storage cell', (assert) => {
      class Foo {
        foo = 123;
        bar = 456;
      }

      let { getter, setter } = trackedData<Foo, keyof Foo>('foo', (self: Foo) => self.bar);

      let foo = new Foo();
      let tag = track(() => {
        assert.strictEqual(getter(foo), 456, 'value is set correctly');
      });

      let snapshot = valueForTag(tag);

      setter(foo, 789);
      assert.notOk(validateTag(tag, snapshot));
    });

    if (import.meta.env.DEV) {
      test('it errors when attempting to update a value already consumed in the same transaction', (assert) => {
        class Foo {
          foo = 123;
          bar = 456;
        }

        let { getter, setter } = trackedData<Foo, keyof Foo>('foo', (self: Foo) => {
          return self.bar;
        });

        let foo = new Foo();

        assert.throws(() => {
          debug.runInTrackingTransaction!(() => {
            track(() => {
              getter(foo);
              setter(foo, 789);
            });
          });
        }, /You attempted to update `foo` on `\(an instance of/u);
      });
    }
  });

  if (import.meta.env.DEV) {
    module('debug', () => {
      test('it errors when attempting to update a value that has already been consumed in the same transaction', (assert) => {
        let tag = createTag();

        assert.throws(() => {
          debug.runInTrackingTransaction!(() => {
            track(() => {
              consumeTag(tag);
              dirtyTag(tag);
            });
          });
        }, /Error: You attempted to update `\(an unknown tag\)`/u);
      });

      test('it throws errors across track frames within the same debug transaction', (assert) => {
        let tag = createTag();

        assert.throws(() => {
          debug.runInTrackingTransaction!(() => {
            track(() => {
              consumeTag(tag);
            });

            track(() => {
              dirtyTag(tag);
            });
          });
        }, /Error: You attempted to update `\(an unknown tag\)`/u);
      });

      test('it ignores untrack for consumption', (assert) => {
        assert.expect(0);
        let tag = createTag();

        debug.runInTrackingTransaction!(() => {
          untrack(() => {
            consumeTag(tag);
          });

          track(() => {
            dirtyTag(tag);
          });
        });
      });

      test('it does not ignore untrack for dirty', (assert) => {
        let tag = createTag();

        assert.throws(() => {
          debug.runInTrackingTransaction!(() => {
            track(() => {
              consumeTag(tag);
            });

            untrack(() => {
              dirtyTag(tag);
            });
          });
        }, /Error: You attempted to update `\(an unknown tag\)`/u);
      });
    });
  }
});
