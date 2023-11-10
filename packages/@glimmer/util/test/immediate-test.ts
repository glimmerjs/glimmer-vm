import {
  decodeBoolean,
  decodeImmediate,
  encodeBoolean,
  encodeImmediate,
  MAX_INT,
  MAX_SMI,
  MIN_INT,
  MIN_SMI,
} from '@glimmer/util';

const { module, test } = QUnit;

module('immediate encoding tests', () => {
  test('encode correctly', (assert) => {
    let cases = [MIN_INT, -1, 0, MAX_INT];

    for (const val of cases) {
      let encoded = encodeImmediate(val);

      assert.strictEqual(val, decodeImmediate(encoded), 'correctly encoded and decoded');
      const isSMI = encoded >= MIN_SMI && encoded <= MAX_SMI;
      assert.true(isSMI, 'encoded as an SMI');
      assert.step(`testing ${val}`);
    }

    assert.verifySteps(cases.map((val) => `testing ${val}`));
  });

  test('encode booleans correctly', (assert) => {
    let cases = [true, false];

    for (const val of cases) {
      let encoded = encodeBoolean(val);

      assert.strictEqual(val, decodeBoolean(encoded), 'correctly encoded and decoded');
    }
  });
});
