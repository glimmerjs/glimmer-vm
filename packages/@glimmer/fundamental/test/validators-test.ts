import type { DirtyableTag, UpdatableTag } from '@glimmer/interfaces';
import { allowCycles } from '@glimmer/debug';
import { combineTags, dirtyTag, TagImpl, validateTag, valueForTag } from '@glimmer/fundamental';
import { testOverrideGlobalContext } from '@glimmer/global-context';

import { CONSTANT_TAG, createTag, createUpdatableTag, CURRENT_TAG, module, test } from './-utils';

function unwrap<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('unexpected null or undefined value');
  }

  return value;
}

module('@glimmer/fundamental: validators', () => {
  module('DirtyableTag', () => {
    test('it can be dirtied', (assert) => {
      let tag = createTag();
      let snapshot = valueForTag(tag);

      assert.ok(validateTag(tag, snapshot));

      dirtyTag(tag);
      assert.notOk(validateTag(tag, snapshot));

      snapshot = valueForTag(tag);
      assert.ok(validateTag(tag, snapshot));
    });

    test('it calls scheduleRevalidate', (assert) => {
      const override = unwrap(testOverrideGlobalContext)({
        scheduleRevalidate() {
          assert.step('scheduleRevalidate');
          assert.ok(true, 'called');
        },
      });

      try {
        let tag = createTag();

        dirtyTag(tag);
      } finally {
        override.done();
      }

      assert.verifySteps(['scheduleRevalidate']);
    });

    if (import.meta.env.DEV) {
      test('it cannot be updated', (assert) => {
        let tag = createTag();
        let subtag = createTag();

        assert.throws(
          () => TagImpl.update(tag as unknown as UpdatableTag, subtag),
          /Error: Attempted to update a tag that was not updatable/u
        );
      });
    }
  });

  module('UpdatableTag', () => {
    test('it can be dirtied', (assert) => {
      let tag = createUpdatableTag();
      let snapshot = valueForTag(tag);

      assert.ok(validateTag(tag, snapshot));

      dirtyTag(tag);
      assert.notOk(validateTag(tag, snapshot));

      snapshot = valueForTag(tag);
      assert.ok(validateTag(tag, snapshot));
    });

    test('it can be updated', (assert) => {
      let tag = createUpdatableTag();
      let subtag = createUpdatableTag();

      TagImpl.update(tag, subtag);

      let snapshot = valueForTag(tag);
      assert.ok(validateTag(tag, snapshot));

      dirtyTag(subtag);
      assert.notOk(validateTag(tag, snapshot));

      snapshot = valueForTag(tag);
      assert.ok(validateTag(tag, snapshot));
    });

    test('it correctly buffers updates when subtag has a less recent value', (assert) => {
      let tag = createUpdatableTag();
      let subtag = createUpdatableTag();

      // First, we dirty the parent tag so it is more recent than the subtag
      dirtyTag(tag);

      // Then, we get a snapshot of the parent
      let snapshot = valueForTag(tag);

      // Now, we update the parent tag with the subtag, and revalidate it
      TagImpl.update(tag as unknown as UpdatableTag, subtag);

      assert.ok(validateTag(tag, snapshot), 'tag is still valid after being updated');

      // Finally, dirty the subtag one final time to bust the buffer cache
      dirtyTag(subtag);

      assert.notOk(validateTag(tag, snapshot), 'tag is invalid after subtag is dirtied again');
    });

    test('it correctly buffers updates when subtag has a more recent value', (assert) => {
      let tag = createUpdatableTag();
      let subtag = createUpdatableTag();

      // First, we get a snapshot of the parent
      let snapshot = valueForTag(tag);

      // Then we dirty the currently unrelated subtag
      dirtyTag(subtag);

      // Now, we update the parent tag with the subtag, and revalidate it
      TagImpl.update(tag, subtag);

      assert.ok(validateTag(tag, snapshot), 'tag is still valid after being updated');

      // Finally, dirty the subtag one final time to bust the buffer cache
      dirtyTag(subtag);

      assert.notOk(validateTag(tag, snapshot), 'tag is invalid after subtag is dirtied again');
    });

    if (import.meta.env.DEV) {
      test('does not allow cycles on tags that have not been marked with ALLOW_CYCLES', (assert) => {
        let tag = createUpdatableTag();
        let subtag = createUpdatableTag();

        let snapshot = valueForTag(tag);

        TagImpl.update(tag, subtag);
        TagImpl.update(subtag, tag);

        dirtyTag(tag);

        assert.throws(() => validateTag(tag, snapshot));
      });

      test('does allow cycles on tags that have been marked with ALLOW_CYCLES', (assert) => {
        let tag = createUpdatableTag();
        let subtag = createUpdatableTag();

        let snapshot = valueForTag(tag);

        allowCycles(tag);
        allowCycles(subtag);

        TagImpl.update(tag, subtag);
        TagImpl.update(subtag, tag);

        dirtyTag(tag);

        assert.notOk(validateTag(tag, snapshot));
      });
    }
  });

  module('CombinatorTag', () => {
    test('it can combine multiple tags', (assert) => {
      let tag1 = createTag();
      let tag2 = createTag();

      let combined = combineTags([tag1, tag2]);

      let snapshot = valueForTag(combined);
      dirtyTag(tag1);
      assert.notOk(validateTag(combined, snapshot));

      snapshot = valueForTag(combined);
      dirtyTag(tag2);
      assert.notOk(validateTag(combined, snapshot));
    });

    if (import.meta.env.DEV) {
      test('it cannot be dirtied', (assert) => {
        let tag1 = createTag();
        let tag2 = createTag();

        let combined = combineTags([tag1, tag2]);

        assert.throws(
          // This cast is intentionally unsound in order to trigger an
          // error condition that would otherwise be caught by the type
          // system
          () => dirtyTag(combined as unknown as DirtyableTag),
          /Error: Attempted to dirty a tag that was not dirtyable/u
        );
      });

      test('it cannot be updated', (assert) => {
        let tag1 = createTag();
        let tag2 = createTag();

        let combined = combineTags([tag1, tag2]);

        assert.throws(
          // this cast is intentionally unsound because the types
          // would normally prevent this error condition from
          // occuring.
          () => TagImpl.update(combined as UpdatableTag, tag1),
          /Error: Attempted to update a tag that was not updatable/u
        );
      });
    }
  });

  module('ConstantTag', () => {
    if (import.meta.env.DEV) {
      test('it cannot be dirtied', (assert) => {
        assert.throws(
          // Intentionally unsound because the types would normally prevent this error
          // condition from occuring
          () => dirtyTag(CONSTANT_TAG as unknown as DirtyableTag),
          /Error: Attempted to dirty a tag that was not dirtyable/u
        );
      });

      test('it cannot be updated', (assert) => {
        let subtag = createTag();

        assert.throws(
          // This cast is intentionally unsound in order to trigger an
          // error condition that would otherwise be caught by the type
          // system
          () => TagImpl.update(CONSTANT_TAG as unknown as UpdatableTag, subtag),
          /Error: Attempted to update a tag that was not updatable/u
        );
      });
    }
  });

  module('CurrentTag', () => {
    test('it is always the current revision', (assert) => {
      let snapshot = valueForTag(CURRENT_TAG);
      assert.ok(validateTag(CURRENT_TAG, snapshot));

      let tag = createTag();
      dirtyTag(tag);

      assert.notOk(validateTag(CURRENT_TAG, snapshot));
    });

    test('it ensures that any tags which it is combined with are also always the current revision', (assert) => {
      let tag2 = createTag();
      let combined = combineTags([CURRENT_TAG, tag2]);

      let snapshot = valueForTag(combined);
      assert.ok(validateTag(combined, snapshot));

      let otherTag = createTag();
      dirtyTag(otherTag);

      assert.notOk(validateTag(combined, snapshot));
    });

    if (import.meta.env.DEV) {
      test('it cannot be dirtied', (assert) => {
        assert.throws(
          // This cast is intentionally unsound in order to trigger an
          // error condition that would otherwise be caught by the type
          // system
          () => dirtyTag(CURRENT_TAG as unknown as DirtyableTag),
          /Error: Attempted to dirty a tag that was not dirtyable/u
        );
      });

      test('it cannot be updated', (assert) => {
        let subtag = createTag();

        assert.throws(
          // This cast is intentionally unsound in order to trigger an
          // error condition that would otherwise be caught by the type
          // system
          () => TagImpl.update(CURRENT_TAG as unknown as UpdatableTag, subtag),
          /Error: Attempted to update a tag that was not updatable/u
        );
      });
    }
  });
});
