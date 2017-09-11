import { OpcodePrinter } from '@glimmer/test-helpers';
declare function require(id: string): any;

/* tslint:disable:no-require-imports */
let { sync: glob } = require('glob');
let { readFileSync } = require('fs');
/* tslint:enable:no-require-imports */

let goldens = glob('packages/@glimmer/bundle-compiler/test/golden/*.golden');

goldens.forEach((golden: string) => {
  let gold = JSON.parse(readFileSync(golden));
  Object.keys(gold.cases).forEach(caseName => {
    QUnit.module(`[Opcode Expectations] ${caseName}`);
    QUnit.test(`compiles ${gold.cases[caseName].snippet}`, (assert) => {
      let { snippet, setupPath, opcodes, constantPool } = gold.cases[caseName];
      let printer = new OpcodePrinter();
      if (setupPath) {
        /* tslint:disable:no-require-imports */
        let setup = require(setupPath);
        /* tslint:enable:no-require-imports */
        setup.setups[caseName](printer);
      }
      let out = printer.print(snippet);
      assert.deepEqual(out, { snippet, opcodes, constantPool });
    });
  });
});
