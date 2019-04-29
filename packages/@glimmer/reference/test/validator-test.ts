import { combine, UpdatableTag, DirtyableTag, CONSTANT_TAG } from '@glimmer/reference';

const { module, test } = QUnit;

module('validators', () => {
  module('CachedTag', () => {
    test('tag cycles do not result in improperly cached tags', assert => {
      let tag1 = combine([DirtyableTag.create(), UpdatableTag.create(CONSTANT_TAG)]);
      let tag2 = combine([DirtyableTag.create(), UpdatableTag.create(CONSTANT_TAG)]);

      // setup the cycle
      (tag1.inner! as any).second.inner.update(tag2);
      (tag2.inner! as any).second.inner.update(tag1);

      // Cache the first tag
      let revision = tag1.value();

      // Dirty the second tag
      (tag2.inner! as any).first.inner.dirty();

      // Get the second tag, causing the first to recompute
      tag2.value();

      // Make sure the first tag didn't cache eagerly before the second tag finished calculating its value
      assert.notOk(tag1.validate(revision));
    });
  });
});
