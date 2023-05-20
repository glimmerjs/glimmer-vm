import {
  decodeImmediate,
  encodeImmediate,
  MAX_INT,
  MAX_SMI,
  MIN_INT,
  MIN_SMI,
} from '@glimmer/util';

const { module, test } = QUnit;

module('immediate encoding tests', () => {
  test('it works', (assert) => {
    let cases = [MIN_INT, -1, 0, MAX_INT];

    for (let value of cases) {
      let encoded = encodeImmediate(value);

      assert.strictEqual(value, decodeImmediate(encoded), 'correctly encoded and decoded');
      let isSMI = encoded >= MIN_SMI && encoded <= MAX_SMI;
      assert.true(isSMI, 'encoded as an SMI');
      assert.step(`testing ${value}`);
    }

    assert.verifySteps(cases.map((value) => `testing ${value}`));
  });
});
