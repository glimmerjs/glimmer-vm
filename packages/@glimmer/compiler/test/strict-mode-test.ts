import { test, module } from './support';
import { WireFormat } from '@glimmer/interfaces';
import { precompile } from '@glimmer/compiler';

import Op = WireFormat.SexpOpcodes;

@module
export class StrictModeTests {
  @test text(assert: Assert) {
    let ir = this.preprocess('hello world');

    assert.deepEqual(ir, block([[Op.Text, 'hello world']]));
  }

  @test comment(assert: Assert) {
    let ir = this.preprocess('<!-- hello world -->');

    assert.deepEqual(ir, block([[Op.Comment, ' hello world ']]));
  }

  @test elements(assert: Assert) {
    let ir = this.preprocess('<div></div>');

    assert.deepEqual(ir, block([[Op.OpenElement, 'div'], [Op.FlushElement], [Op.CloseElement]]));
  }

  @test attributes(assert: Assert) {
    let ir = this.preprocess(
      `<div class="hello world" data-title="it's me">i've been wondering</div>`
    );

    assert.deepEqual(
      ir,
      block([
        [Op.OpenElement, 'div'],
        [Op.StaticAttr, 'class', 'hello world', null],
        [Op.StaticAttr, 'data-title', "it's me", null],
        [Op.FlushElement],
        [Op.Text, "i've been wondering"],
        [Op.CloseElement],
      ])
    );
  }

  @test 'curly with this'(assert: Assert) {
    let ir = this.preprocess('{{this.hello}}');

    assert.deepEqual(ir, block([[Op.Append, [Op.Get, 0, ['hello']], false]]));
  }

  @test 'curly with free variable'(assert: Assert) {
    let ir = this.preprocess('{{hello}}');

    assert.deepEqual(ir, block([[Op.Append, [Op.FreeVariable, ['hello']], false]]));
  }

  private preprocess(template: string): WireFormat.SerializedTemplateBlock {
    return JSON.parse(JSON.parse(precompile(template, { meta: undefined, strict: true })).block);
  }
}

function block(
  statements: WireFormat.Statement[],
  symbols?: string[]
): WireFormat.SerializedTemplateBlock {
  return {
    hasEval: false,
    statements,
    symbols: symbols || [],
  };
}
