import { UpdatableDirtyableTag } from '@glimmer/reference';

const { module, test } = QUnit;

module('validators', () => {
  module('CachedTag', () => {
    test('tag cycles do not result in improperly cached tags', assert => {
      let tag1 = UpdatableDirtyableTag.create();
      let tag2 = UpdatableDirtyableTag.create();

      // setup the cycle
      tag1.inner.update(tag2);
      tag2.inner.update(tag1);

      // Cache the first tag
      let revision = tag1.value();

      // Dirty the second tag
      tag2.inner.dirty();

      // Get the second tag, causing the first to recompute
      tag2.value();

      // Make sure the first tag didn't cache eagerly before the second tag finished calculating its value
      assert.notOk(tag1.validate(revision));
    });
  });
});
