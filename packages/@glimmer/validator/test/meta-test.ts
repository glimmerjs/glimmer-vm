import { dirtyTagFor, infoForTag, tagFor, validateTag, valueForTag } from '@glimmer/validator';

import { module, test } from './-utils';

module('@glimmer/validator: meta', () => {
  test('it creates a unique tag for a property on a given object', (assert) => {
    let obj = {};
    let tag = tagFor(obj, 'foo');
    assert.strictEqual(tagFor(obj, 'foo'), tag);
  });

  test('it can dirty the tag for a property on a given object', (assert) => {
    let obj = {};
    let tag = tagFor(obj, 'foo');

    let snapshot = valueForTag(tag);
    dirtyTagFor(obj, 'foo');

    assert.notOk(validateTag(tag, snapshot));
  });

  test('it can provide the object and property for the tag given object', (assert) => {
    let obj = {};
    let tag = tagFor(obj, 'foo');

    let info = infoForTag(tag)!;
    assert.strictEqual(info.object, obj);
    assert.strictEqual(info.propertyKey, 'foo');
  });
});
