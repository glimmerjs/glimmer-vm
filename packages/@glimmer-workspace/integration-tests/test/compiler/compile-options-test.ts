import type { WireFormat } from '@glimmer/interfaces';
import type { TemplateWithIdAndReferrer } from '@glimmer/opcode-compiler';
import { precompile } from '@glimmer/compiler';
import { localAssert, unwrapTemplate } from '@glimmer/debug-util';
import { SexpOpcodes } from '@glimmer/wire-format';
import { preprocess } from '@glimmer-workspace/integration-tests';

import { module } from '../support';

module('[glimmer-compiler] Compile options', ({ test }) => {
  test('moduleName option is passed into meta', (assert) => {
    let moduleName = "It ain't hard to tell";
    let template = unwrapTemplate(
      preprocess('Hi, {{name}}!', { meta: { moduleName } })
    ) as TemplateWithIdAndReferrer;
    assert.strictEqual(template.referrer.moduleName, moduleName, 'Template has the moduleName');
  });
});

module('[glimmer-compiler] precompile', ({ test }) => {
  test('returned module name correct', (assert) => {
    let wire = JSON.parse(
      precompile('Hi, {{name}}!', {
        meta: { moduleName: 'my/module-name' },
      })
    );

    assert.strictEqual(wire.moduleName, 'my/module-name', 'Template has correct meta');
  });

  function compile(
    template: string,
    locals: string[],
    evaluate: (source: string) => WireFormat.SerializedTemplateWithLazyBlock
  ) {
    let source = precompile(template, {
      lexicalScope: (variable: string) => locals.includes(variable),
    });

    let wire = evaluate(`(${source})`);

    return {
      ...wire,
      block: JSON.parse(wire.block),
    };
  }

  test('lexicalScope is used if present', (assert) => {
    let wire = compile(`<hello /><div />`, ['hello'], (source) => eval(source));

    const hello = { varname: 'hello' };
    assert.ok(hello, 'avoid unused variable lint');

    let [statements] = wire.block;
    let [[, componentNameExpr], ...divExpr] = statements as [
      WireFormat.Statements.Component,
      ...WireFormat.Statement[],
    ];

    assert.deepEqual(wire.scope?.(), [hello]);

    assert.deepEqual(
      componentNameExpr,
      [SexpOpcodes.GetLexicalSymbol, 0],
      'The component invocation is for the lexical symbol `hello` (the 0th lexical entry)'
    );

    assert.deepEqual(divExpr, [
      [SexpOpcodes.OpenElement, 0],
      [SexpOpcodes.FlushElement],
      [SexpOpcodes.CloseElement],
    ]);
  });

  test('lexicalScope works if the component name is a path', (assert) => {
    let wire = compile(`<f.hello /><div />`, ['f'], (source) => eval(source));

    const f = {};
    assert.ok(f, 'avoid unused variable lint');

    let [statements] = wire.block;
    let [[, componentNameExpr], ...divExpr] = statements as [
      WireFormat.Statements.Component,
      ...WireFormat.Statement[],
    ];

    assert.deepEqual(wire.scope?.(), [f]);
    assert.deepEqual(
      componentNameExpr,
      [SexpOpcodes.GetLexicalSymbol, 0, ['hello']],
      'The component invocation is for the lexical symbol `hello` (the 0th lexical entry)'
    );

    assert.deepEqual(divExpr, [
      [SexpOpcodes.OpenElement, 0],
      [SexpOpcodes.FlushElement],
      [SexpOpcodes.CloseElement],
    ]);
  });

  test('customizeComponentName is used if present', (assert) => {
    let wire = JSON.parse(
      precompile('<XFoo />', {
        customizeComponentName(input: string) {
          return input.split('').reverse().join('');
        },
      })
    );

    let block: WireFormat.SerializedTemplateBlock = JSON.parse(wire.block);
    let [[, componentNameExpr]] = block[0] as [WireFormat.Statements.Component];

    localAssert(
      Array.isArray(componentNameExpr) &&
        componentNameExpr[0] === SexpOpcodes.GetFreeAsComponentHead,
      `component name is a free variable lookup`
    );

    let componentName = block[2][componentNameExpr[1]];
    assert.strictEqual(componentName, 'ooFX', 'customized component name was used');
  });

  test('customizeComponentName does not cause components to conflict with existing symbols', (assert) => {
    let wire = JSON.parse(
      precompile('{{#let @model as |rental|}}<Rental @renter={{rental}} />{{/let}}', {
        customizeComponentName(input: string) {
          return input.toLowerCase();
        },
      })
    );

    let block: WireFormat.SerializedTemplateBlock = JSON.parse(wire.block);

    let [[, , letBlock]] = block[0] as [WireFormat.Statements.Let];
    let [[, componentNameExpr]] = letBlock[0] as [WireFormat.Statements.Component];

    localAssert(
      Array.isArray(componentNameExpr) &&
        componentNameExpr[0] === SexpOpcodes.GetFreeAsComponentHead,
      `component name is a free variable lookup`
    );

    let componentName = block[2][componentNameExpr[1]];
    assert.strictEqual(componentName, 'rental', 'customized component name was used');
  });

  test('customizeComponentName is not invoked on curly components', (assert) => {
    let wire = JSON.parse(
      precompile('{{#my-component}}hello{{/my-component}}', {
        customizeComponentName(input: string) {
          return input.toUpperCase();
        },
      })
    );

    let block: WireFormat.SerializedTemplateBlock = JSON.parse(wire.block);

    let [[, componentNameExpr]] = block[0] as [WireFormat.Statements.Block];

    localAssert(
      Array.isArray(componentNameExpr) &&
        componentNameExpr[0] === SexpOpcodes.GetFreeAsComponentHead,
      `component name is a free variable lookup`
    );

    let componentName = block[2][componentNameExpr[1]];
    assert.strictEqual(componentName, 'my-component', 'original component name was used');
  });

  test('customizeComponentName is not invoked on angle-bracket-like name invoked with curlies', (assert) => {
    let wire = JSON.parse(
      precompile('{{#MyComponent}}hello{{/MyComponent}}', {
        customizeComponentName(input: string) {
          return input.toUpperCase();
        },
      })
    );

    let block: WireFormat.SerializedTemplateBlock = JSON.parse(wire.block);

    let [[, componentNameExpr]] = block[0] as [WireFormat.Statements.Block];

    localAssert(
      Array.isArray(componentNameExpr) &&
        componentNameExpr[0] === SexpOpcodes.GetFreeAsComponentHead,
      `component name is a free variable lookup`
    );

    let componentName = block[2][componentNameExpr[1]];
    assert.strictEqual(componentName, 'MyComponent', 'original component name was used');
  });

  test('lowercased names are not resolved or customized in resolution mode', (assert) => {
    let wire = JSON.parse(
      precompile('<rental />', {
        customizeComponentName(input: string) {
          return input.split('').reverse().join('');
        },
      })
    );

    let block: WireFormat.SerializedTemplateBlock = JSON.parse(wire.block);
    let [openElementExpr] = block[0];

    localAssert(
      Array.isArray(openElementExpr) && openElementExpr[0] === SexpOpcodes.OpenElement,
      `expr is open element`
    );

    let elementName = openElementExpr[1];
    assert.strictEqual(elementName, 'rental', 'element name is correct');
  });

  test('when "this" in in locals, it compiles to GetLexicalSymbol', (assert) => {
    let target = { message: 'hello' };
    let _wire: ReturnType<typeof compile>;
    (function () {
      _wire = compile(`{{this.message}}`, ['this'], (source) => eval(source));
    }).call(target);
    let wire = _wire!;
    assert.deepEqual(wire.scope?.(), [target]);
    assert.deepEqual(wire.block[0], [
      [SexpOpcodes.Append, [SexpOpcodes.GetLexicalSymbol, 0, ['message']]],
    ]);
  });

  test('when "this" is not in locals, it compiles to GetSymbol', (assert) => {
    let wire = compile(`{{this.message}}`, [], (source) => eval(source));
    assert.strictEqual(wire.scope, undefined);
    assert.deepEqual(wire.block[0], [
      [SexpOpcodes.Append, [SexpOpcodes.GetSymbol, 0, ['message']]],
    ]);
  });
});
