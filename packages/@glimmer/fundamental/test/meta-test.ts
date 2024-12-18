import { validateTag, valueForTag } from '@glimmer/fundamental';

import { dirtyTagFor, module, test, upsertTagForKey } from './-utils';

module('@glimmer/fundamental: meta', () => {
  test('it creates a unique tag for a property on a given object', (assert) => {
    let obj = {};
    let tag = upsertTagForKey(obj, 'foo');
    assert.strictEqual(upsertTagForKey(obj, 'foo'), tag);
  });

  test('it can dirty the tag for a property on a given object', (assert) => {
    let obj = {};
    let tag = upsertTagForKey(obj, 'foo');

    let snapshot = valueForTag(tag);
    dirtyTagFor(obj, 'foo');

    assert.notOk(validateTag(tag, snapshot));
  });
});
