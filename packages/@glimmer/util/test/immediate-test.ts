import { encodeImmediate, decodeImmediate, ImmediateMapping } from '..';

const { module, test } = QUnit;

module('immediate encoding tests', () => {
  test('it works', assert => {
    [
      ImmediateMapping.MIN_INT,
      -1,
      0,
      ImmediateMapping.MAX_INT,
      undefined,
      null,
      true,
      false,
    ].forEach(val => {
      assert.equal(val, decodeImmediate(encodeImmediate(val)), 'correctly encdoded and decoded');
    });
  });
});
