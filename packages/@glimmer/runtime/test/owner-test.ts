import { getOwner, setOwner } from '..';

QUnit.module('[@glimmer/runtime] Owner');

QUnit.test('@test An owner can be set with `setOwner` and retrieved with `getOwner`', assert => {
  let owner = {};
  let obj = {};

  assert.strictEqual(getOwner(obj), undefined, 'owner has not been set');

  setOwner(obj, owner);

  assert.strictEqual(getOwner(obj), owner, 'owner has been set');
});
