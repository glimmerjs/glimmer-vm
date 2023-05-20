
QUnit.module('object-utils tests');

QUnit.test('assign should ignore null/undefined arguments', function (assert) {
  let result = { foo: 'bar', ...null, ...undefined, derp: 'herk'};

  assert.deepEqual(result, { foo: 'bar', derp: 'herk' }, 'has correct result');
});
