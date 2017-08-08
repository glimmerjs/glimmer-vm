import { precompile } from "@glimmer/compiler";

QUnit.module('default template id');

QUnit.test('generates id in node', function (assert) {
  let template = precompile('hello');
  let obj = JSON.parse(template);
  assert.equal(obj.id, 'zgnsoV7o', 'short sha of template source');
  template = precompile('hello', { meta: {moduleName: 'template/hello'} });
  obj = JSON.parse(template);
  assert.equal(obj.id, 'Ybe5TwSG', 'short sha of template source and meta');
});
