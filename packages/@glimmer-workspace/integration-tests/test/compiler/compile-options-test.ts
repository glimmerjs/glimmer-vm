import type { WireFormat } from '@glimmer/interfaces';
import type { TemplateWithIdAndReferrer } from '@glimmer/opcode-compiler';
import { precompile } from '@glimmer/compiler';
import { localAssert, unwrapTemplate } from '@glimmer/debug-util';
import { SexpOpcodes as Op } from '@glimmer/wire-format';
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
    let [[op, componentNameExpr], ...divExpr] = statements as [
      WireFormat.Content.SomeInvokeComponent,
      ...WireFormat.Content[],
    ];

    localAssert(
      op === Op.InvokeLexicalComponent,
      'The first content item in the template is a lexical invoke component'
    );

    assert.deepEqual(wire.scope?.(), [hello]);

    assert.deepEqual(
      componentNameExpr,
      0,
      'The component invocation is for the lexical symbol `hello` (the 0th lexical entry)'
    );

    assert.deepEqual(divExpr, [[Op.OpenElement, 0], [Op.FlushElement], [Op.CloseElement]]);
  });

  test('lexicalScope works if the component name is a path', (assert) => {
    let wire = compile(`<f.hello /><div />`, ['f'], (source) => eval(source));

    const f = {};
    assert.ok(f, 'avoid unused variable lint');

    let [statements] = wire.block;
    let [[, componentNameExpr], ...divExpr] = statements as [
      WireFormat.Content.SomeInvokeComponent,
      ...WireFormat.Content[],
    ];

    assert.deepEqual(wire.scope?.(), [f]);
    assert.deepEqual(
      componentNameExpr,
      [Op.StackExpression, [Op.GetLexicalSymbol, 0], [Op.GetProperty, 'hello']],
      'The component invocation is for the lexical symbol `hello` (the 0th lexical entry)'
    );

    assert.deepEqual(divExpr, [[Op.OpenElement, 0], [Op.FlushElement], [Op.CloseElement]]);
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
    let [invoke] = block[0] as [WireFormat.Content.SomeInvokeComponent];

    localAssert(
      invoke[0] === Op.InvokeResolvedComponent,
      `The first content item in the template is an resolved invoke component`
    );

    let componentName = block[2][invoke[1]];
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

    let [[, , letBlock]] = block[0] as [WireFormat.Content.Let];

    let [[invoke]] = letBlock;

    localAssert(
      invoke?.[0] === Op.InvokeResolvedComponent,
      `the first content item in the let block is an invoke component`
    );
    let componentName = block[2][invoke[1]];
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

    let [invoke] = block[0] as [WireFormat.Content.SomeInvokeComponent];

    localAssert(
      invoke[0] === Op.InvokeResolvedComponent,
      `component name is a free variable lookup`
    );

    let componentName = block[2][invoke[1]];
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

    let [invoke] = block[0] as [WireFormat.Content.SomeInvokeComponent];

    localAssert(
      invoke[0] === Op.InvokeResolvedComponent,
      `first content item is a resolved invoke component`
    );

    let componentName = block[2][invoke[1]];
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
      Array.isArray(openElementExpr) && openElementExpr[0] === Op.OpenElement,
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
      [
        Op.AppendValueCautiously,
        [Op.StackExpression, [Op.GetLexicalSymbol, 0], [Op.GetProperty, 'message']],
      ],
    ] satisfies WireFormat.Content[]);
  });

  test('when "this" is not in locals, it compiles to GetSymbolOrPath', (assert) => {
    let wire = compile(`{{this.message}}`, [], (source) => eval(source));
    assert.strictEqual(wire.scope, undefined);
    assert.deepEqual(wire.block[0], [
      [
        Op.AppendValueCautiously,
        [Op.StackExpression, [Op.GetLocalSymbol, 0], [Op.GetProperty, 'message']],
      ],
    ] satisfies WireFormat.Content[]);
  });
});
