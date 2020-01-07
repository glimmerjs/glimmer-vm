import { module, test } from './-utils';
import { DEBUG } from '@glimmer/env';

import {
  ALLOW_CYCLES,
  CONSTANT_TAG,
  CURRENT_TAG,
  VOLATILE_TAG,
  bump,
  combine,
  createTag,
  createUpdatableTag,
  dirty,
  update,
  validate,
  value,
} from '..';

module('@glimmer/validator: validators', () => {
  module('DirtyableTag', () => {
    test('it can be dirtied', assert => {
      let tag = createTag();
      let snapshot = value(tag);

      assert.ok(validate(tag, snapshot));

      dirty(tag);
      assert.notOk(validate(tag, snapshot));

      snapshot = value(tag);
      assert.ok(validate(tag, snapshot));
    });

    if (DEBUG) {
      test('it cannot be updated', assert => {
        let tag = createTag();
        let subtag = createTag();

        assert.throws(
          () => update(tag as any, subtag),
          /Error: Attempted to update a tag that was not updatable/
        );
      });
    }
  });

  module('UpdatableTag', () => {
    test('it can be dirtied', assert => {
      let tag = createUpdatableTag();
      let snapshot = value(tag);

      assert.ok(validate(tag, snapshot));

      dirty(tag);
      assert.notOk(validate(tag, snapshot));

      snapshot = value(tag);
      assert.ok(validate(tag, snapshot));
    });

    test('it can be updated', assert => {
      let tag = createUpdatableTag();
      let subtag = createUpdatableTag();

      update(tag, subtag);

      let snapshot = value(tag);
      assert.ok(validate(tag, snapshot));

      dirty(subtag);
      assert.notOk(validate(tag, snapshot));

      snapshot = value(tag);
      assert.ok(validate(tag, snapshot));
    });

    if (DEBUG) {
      test('it throws an error when updating a tag that has been validated with a tag that is more recent', assert => {
        let tag = createUpdatableTag();
        let subtag = createUpdatableTag();

        // First, we get a snapshot of the parent
        let snapshot = value(tag);

        // Then we dirty the currently unrelated subtag
        dirty(subtag);

        // Then we validate the parent tag. This should "lock in" the tag, because it
        // means we are verifying that whatever calculation it represents has not changed
        assert.ok(validate(tag, snapshot));

        // Now, we attempt to update the parent with the subtag. The parent has been locked
        // in, but the subtag has a more recent value, which means we have backflowed. This
        // should throw an error.
        assert.throws(
          () => update(tag as any, subtag),
          /Error: BUG: attempted to update a tag with a tag that has a more recent revision as its value/
        );
      });

      test('it throws an error when updating a tag that has been invalidated AND whose value has been read with a tag that is more recent', assert => {
        let tag = createUpdatableTag();
        let subtag = createUpdatableTag();

        // First, we get a snapshot of the parent
        let snapshot = value(tag);

        // Then we dirty the parent so it is out of date
        dirty(tag);

        // Then we dirty the currently unrelated subtag, so it has a more recent value
        dirty(subtag);

        // Then we attempt validate the parent tag. The validation will fail, and will
        // NOT lock in the parent value just yet.
        assert.notOk(validate(tag, snapshot));

        // Then we get the parent tag's value, which does lock in the value.
        snapshot = value(tag);

        // Now, we attempt to update the parent with the subtag. The parent has been locked
        // in, but the subtag has a more recent value, which means we have backflowed. This
        // should throw an error.
        assert.throws(
          () => update(tag as any, subtag),
          /Error: BUG: attempted to update a tag with a tag that has a more recent revision as its value/
        );
      });

      test('does not throw an error when updating a tag that has been invalidated AND whose value has NOT been read with a tag that is more recent', assert => {
        let tag = createUpdatableTag();
        let subtag = createUpdatableTag();

        // First, we get a snapshot of the parent
        let snapshot = value(tag);

        // Then we dirty the parent so it is out of date
        dirty(tag);

        // Then we dirty the currently unrelated subtag, so it has a more recent value
        dirty(subtag);

        // Then we attempt validate the parent tag. The validation will fail, and will
        // NOT lock in the parent value just yet.
        assert.notOk(validate(tag, snapshot));

        // Now we update the parent to the new subtag, BEFORE its value has been
        // calculated. Since we know the value hasn't been calculated or locked into
        // the cache, this update is valid.
        update(tag as any, subtag);

        // Then we get the parent tag's value, which does lock in the value.
        snapshot = value(tag);

        // Do an unrelated bump (something else in the system changed)
        bump();

        // Caches were fully busted, but the value was still correct.
        assert.ok(validate(tag, snapshot));
      });

      test('does not allow cycles on tags that have not been marked with ALLOW_CYCLES', assert => {
        let tag = createUpdatableTag();
        let subtag = createUpdatableTag();

        let snapshot = value(tag);

        update(tag, subtag);
        update(subtag, tag);

        dirty(tag);

        assert.throws(() => validate(tag, snapshot));
      });

      test('does allow cycles on tags that have been marked with ALLOW_CYCLES', assert => {
        let tag = createUpdatableTag();
        let subtag = createUpdatableTag();

        let snapshot = value(tag);

        ALLOW_CYCLES!.set(tag, true);
        ALLOW_CYCLES!.set(subtag, true);

        update(tag, subtag);
        update(subtag, tag);

        dirty(tag);

        assert.notOk(validate(tag, snapshot));
      });
    }
  });

  module('CombinatorTag', () => {
    test('it can combine multiple tags', assert => {
      let tag1 = createTag();
      let tag2 = createTag();

      let combined = combine([tag1, tag2]);

      let snapshot = value(combined);
      dirty(tag1);
      assert.notOk(validate(combined, snapshot));

      snapshot = value(combined);
      dirty(tag2);
      assert.notOk(validate(combined, snapshot));
    });

    if (DEBUG) {
      test('it cannot be dirtied', assert => {
        let tag1 = createTag();
        let tag2 = createTag();

        let combined = combine([tag1, tag2]);

        assert.throws(
          () => dirty(combined as any),
          /Error: Attempted to dirty a tag that was not dirtyable/
        );
      });

      test('it cannot be updated', assert => {
        let tag1 = createTag();
        let tag2 = createTag();

        let combined = combine([tag1, tag2]);

        assert.throws(
          () => update(combined as any, tag1),
          /Error: Attempted to update a tag that was not updatable/
        );
      });
    }
  });

  module('ConstantTag', () => {
    if (DEBUG) {
      test('it cannot be dirtied', assert => {
        assert.throws(
          () => dirty(CONSTANT_TAG as any),
          /Error: Attempted to dirty a tag that was not dirtyable/
        );
      });

      test('it cannot be updated', assert => {
        let subtag = createTag();

        assert.throws(
          () => update(CONSTANT_TAG as any, subtag),
          /Error: Attempted to update a tag that was not updatable/
        );
      });
    }
  });

  module('VolatileTag', () => {
    test('it is always invalid', assert => {
      let snapshot = value(VOLATILE_TAG);
      assert.notOk(validate(VOLATILE_TAG, snapshot));
    });

    test('it ensures that any tags which it is combined with are also always invalid', assert => {
      let tag2 = createTag();

      let combined = combine([VOLATILE_TAG, tag2]);

      bump();

      let snapshot = value(combined);
      assert.notOk(validate(combined, snapshot));
    });

    if (DEBUG) {
      test('it cannot be dirtied', assert => {
        assert.throws(
          () => dirty(VOLATILE_TAG as any),
          /Error: Attempted to dirty a tag that was not dirtyable/
        );
      });

      test('it cannot be updated', assert => {
        let subtag = createTag();

        assert.throws(
          () => update(VOLATILE_TAG as any, subtag),
          /Error: Attempted to update a tag that was not updatable/
        );
      });
    }
  });

  module('CurrentTag', () => {
    test('it is always the current revision', assert => {
      let snapshot = value(CURRENT_TAG);
      assert.ok(validate(CURRENT_TAG, snapshot));

      let tag = createTag();
      dirty(tag);

      assert.notOk(validate(CURRENT_TAG, snapshot));
    });

    test('it ensures that any tags which it is combined with are also always the current revision', assert => {
      let tag2 = createTag();
      let combined = combine([CURRENT_TAG, tag2]);

      let snapshot = value(combined);
      assert.ok(validate(combined, snapshot));

      let otherTag = createTag();
      dirty(otherTag);

      assert.notOk(validate(combined, snapshot));
    });

    if (DEBUG) {
      test('it cannot be dirtied', assert => {
        assert.throws(
          () => dirty(CURRENT_TAG as any),
          /Error: Attempted to dirty a tag that was not dirtyable/
        );
      });

      test('it cannot be updated', assert => {
        let subtag = createTag();

        assert.throws(
          () => update(CURRENT_TAG as any, subtag),
          /Error: Attempted to update a tag that was not updatable/
        );
      });
    }
  });
});
