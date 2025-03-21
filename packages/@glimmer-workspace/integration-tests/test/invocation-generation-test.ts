import { JitRenderDelegate, RenderTest } from '@glimmer-workspace/integration-tests';

import { module } from './support';

let renderTests: RenderTest;
module(
  'Render Tests: buildComponent',
  {
    beforeEach() {
      renderTests = new RenderTest(new JitRenderDelegate());
    },
  },
  ({ test }) => {
    test('Can build basic glimmer invocation', (assert) => {
      renderTests['testType'] = 'Glimmer';
      let invocation = renderTests.buildComponent({
        layout: 'Hello',
      });

      assert.strictEqual(invocation, '<TestComponent />');
    });

    test('Can build glimmer invocation with template', (assert) => {
      renderTests['testType'] = 'Glimmer';
      let invocation = renderTests.buildComponent({
        layout: 'Hello {{yield}}',
        template: 'World',
      });

      assert.strictEqual(invocation, '<TestComponent>World</TestComponent>');
    });

    test('Can build glimmer invocation with args', (assert) => {
      renderTests['testType'] = 'Glimmer';
      let invocation = renderTests.buildComponent({
        layout: 'Hello {{yield}}',
        template: 'World',
        args: { foo: 'bar', baz: 1, bar: null, literal: "'literal'" },
      });

      assert.strictEqual(
        invocation,
        "<TestComponent @foo={{bar}} @baz={{1}} @bar={{null}} @literal='literal'>World</TestComponent>"
      );
    });

    test('Can build glimmer invocation with attributes', (assert) => {
      renderTests['testType'] = 'Glimmer';
      let invocation = renderTests.buildComponent({
        layout: 'Hello {{yield}}',
        template: 'World',
        args: { foo: 'bar', baz: 1, bar: null },
        attributes: { 'data-foo': 'bar', id: 'wat' },
      });

      assert.strictEqual(
        invocation,
        '<TestComponent @foo={{bar}} @baz={{1}} @bar={{null}} data-foo=bar id=wat>World</TestComponent>'
      );
    });

    test('Can build glimmer invocation with custom tag name', (assert) => {
      renderTests['testType'] = 'Glimmer';
      let invocation = renderTests.buildComponent({
        name: 'LolWat',
        layout: 'Hello {{yield}}',
        template: 'World',
        args: { foo: 'bar', baz: 1, bar: null },
        attributes: { 'data-foo': '"bar"', id: '"wat"' },
      });

      assert.strictEqual(
        invocation,
        `<LolWat @foo={{bar}} @baz={{1}} @bar={{null}} data-foo="bar" id="wat">World</LolWat>`
      );
    });

    test('Can build glimmer invocation with block params', (assert) => {
      renderTests['testType'] = 'Glimmer';
      let invocation = renderTests.buildComponent({
        name: 'Lol',
        layout: 'Hello {{yield}}',
        template: 'World',
        args: { foo: 'bar', baz: 1, bar: null },
        attributes: { 'data-foo': '"bar"', id: '"wat"' },
        blockParams: ['a b c'],
      });

      assert.strictEqual(
        invocation,
        `<Lol @foo={{bar}} @baz={{1}} @bar={{null}} data-foo="bar" id="wat" as |a b c|>World</Lol>`
      );
    });

    test('Can build basic curly invocation', (assert) => {
      renderTests['testType'] = 'Curly';
      let invocation = renderTests.buildComponent({
        layout: 'Hello',
      });

      assert.strictEqual(invocation, '{{test-component}}');
    });

    test('Can build curly invocation with template', (assert) => {
      renderTests['testType'] = 'Curly';
      let invocation = renderTests.buildComponent({
        layout: 'Hello {{yield}}',
        template: 'World',
      });

      assert.strictEqual(invocation, '{{#test-component}}World{{/test-component}}');
    });

    test('Can build curly invocation with args', (assert) => {
      renderTests['testType'] = 'Curly';
      let invocation = renderTests.buildComponent({
        layout: 'Hello {{yield}}',
        template: 'World',
        args: { foo: 'bar', baz: 1, bar: null },
      });

      assert.strictEqual(
        invocation,
        '{{#test-component foo=bar baz=1 bar=null}}World{{/test-component}}'
      );
    });

    test('Can build curly invocation with attributes throws', (assert) => {
      renderTests['testType'] = 'Curly';

      assert.throws(() => {
        renderTests.buildComponent({
          layout: 'Hello {{yield}}',
          template: 'World',
          args: { foo: 'bar', baz: 1, bar: null },
          attributes: { 'data-foo': '"bar"', id: '"wat"' },
        });
      }, /Cannot pass attributes to curly components/u);
    });

    test("Can build curly invocation with 'attributes' in args", (assert) => {
      renderTests['testType'] = 'Curly';
      let invocation = renderTests.buildComponent({
        layout: 'Hello {{yield}}',
        template: 'World',
        args: { foo: 'bar', baz: 1, bar: null, 'data-foo': '"bar"', id: '"wat"' },
      });

      assert.strictEqual(
        invocation,
        `{{#test-component foo=bar baz=1 bar=null data-foo="bar" id="wat"}}World{{/test-component}}`
      );
    });

    test('Can build curly invocation with custom tag name', (assert) => {
      renderTests['testType'] = 'Curly';
      let invocation = renderTests.buildComponent({
        name: 'lol-wat',
        layout: 'Hello {{yield}}',
        template: 'World',
        args: { foo: 'bar', baz: 1, bar: null, 'data-foo': '"bar"', id: '"wat"' },
      });

      assert.strictEqual(
        invocation,
        `{{#lol-wat foo=bar baz=1 bar=null data-foo="bar" id="wat"}}World{{/lol-wat}}`
      );
    });

    test('Can build curly invocation with block params', (assert) => {
      renderTests['testType'] = 'Curly';
      let invocation = renderTests.buildComponent({
        name: 'lol-wat',
        layout: 'Hello {{yield}}',
        template: 'World',
        args: { foo: 'bar', baz: 1, bar: null, 'data-foo': '"bar"', id: '"wat"' },
        blockParams: ['a b c'],
      });

      assert.strictEqual(
        invocation,
        `{{#lol-wat foo=bar baz=1 bar=null data-foo="bar" id="wat" as |a b c|}}World{{/lol-wat}}`
      );
    });

    test('Can build curly invocation with else', (assert) => {
      renderTests['testType'] = 'Curly';
      let invocation = renderTests.buildComponent({
        name: 'lol-wat',
        layout: 'Hello {{yield}}',
        template: 'World',
        args: { foo: 'bar', baz: 1, bar: null, 'data-foo': '"bar"', id: '"wat"' },
        blockParams: ['a b c'],
        else: 'ELSE',
      });

      assert.strictEqual(
        invocation,
        `{{#lol-wat foo=bar baz=1 bar=null data-foo="bar" id="wat" as |a b c|}}World{{else}}ELSE{{/lol-wat}}`
      );
    });

    test('Can build basic dynamic invocation', (assert) => {
      renderTests['testType'] = 'Dynamic';
      let invocation = renderTests.buildComponent({
        layout: 'Hello',
      });

      assert.strictEqual(invocation, '{{component this.componentName}}');
    });

    test('Can build dynamic invocation with template', (assert) => {
      renderTests['testType'] = 'Dynamic';
      let invocation = renderTests.buildComponent({
        layout: 'Hello {{yield}}',
        template: 'World',
      });

      assert.strictEqual(invocation, '{{#component this.componentName}}World{{/component}}');
    });

    test('Can build dynamic invocation with args', (assert) => {
      renderTests['testType'] = 'Dynamic';
      let invocation = renderTests.buildComponent({
        layout: 'Hello {{yield}}',
        template: 'World',
        args: { foo: 'bar', baz: 1, bar: null },
      });

      assert.strictEqual(
        invocation,
        '{{#component this.componentName foo=bar baz=1 bar=null}}World{{/component}}'
      );
    });

    test('Can build dynamic invocation with custom tag name', (assert) => {
      renderTests['testType'] = 'Dynamic';
      let invocation = renderTests.buildComponent({
        name: 'lol-wat',
        layout: 'Hello {{yield}}',
        template: 'World',
        args: { foo: 'bar', baz: 1, bar: null, 'data-foo': '"bar"', id: '"wat"' },
      });

      assert.strictEqual(
        invocation,
        `{{#component this.componentName foo=bar baz=1 bar=null data-foo="bar" id="wat"}}World{{/component}}`
      );
    });

    test('Can build dynamic invocation with block params', (assert) => {
      renderTests['testType'] = 'Dynamic';
      let invocation = renderTests.buildComponent({
        name: 'lol-wat',
        layout: 'Hello {{yield}}',
        template: 'World',
        args: { foo: 'bar', baz: 1, bar: null, 'data-foo': '"bar"', id: '"wat"' },
        blockParams: ['a b c'],
      });

      assert.strictEqual(
        invocation,
        `{{#component this.componentName foo=bar baz=1 bar=null data-foo="bar" id="wat" as |a b c|}}World{{/component}}`
      );
    });

    test('Can build dynamic invocation with else', (assert) => {
      renderTests['testType'] = 'Dynamic';
      let invocation = renderTests.buildComponent({
        name: 'lol-wat',
        layout: 'Hello {{yield}}',
        template: 'World',
        args: { foo: 'bar', baz: 1, bar: null, 'data-foo': '"bar"', id: '"wat"' },
        blockParams: ['a b c'],
        else: 'ELSE',
      });

      assert.strictEqual(
        invocation,
        `{{#component this.componentName foo=bar baz=1 bar=null data-foo="bar" id="wat" as |a b c|}}World{{else}}ELSE{{/component}}`
      );
    });

    test('Can build basic component invocation', (assert) => {
      renderTests['testType'] = 'TemplateOnly';
      let invocation = renderTests.buildComponent({
        layout: 'Hello',
      });

      assert.strictEqual(invocation, '<TestComponent />');
    });

    test('Can build basic component invocation with template', (assert) => {
      renderTests['testType'] = 'TemplateOnly';
      let invocation = renderTests.buildComponent({
        layout: 'Hello {{yield}}',
        template: 'World',
      });

      assert.strictEqual(invocation, '<TestComponent>World</TestComponent>');
    });

    test('Can build basic component invocation with args', (assert) => {
      renderTests['testType'] = 'TemplateOnly';
      let invocation = renderTests.buildComponent({
        layout: 'Hello {{yield}}',
        template: 'World',
        args: { foo: 'bar', baz: 1, bar: null },
      });

      assert.strictEqual(
        invocation,
        '<TestComponent @foo={{bar}} @baz={{1}} @bar={{null}}>World</TestComponent>'
      );
    });

    test('Can build basic component invocation with attributes', (assert) => {
      renderTests['testType'] = 'TemplateOnly';
      let invocation = renderTests.buildComponent({
        layout: 'Hello {{yield}}',
        template: 'World',
        args: { foo: 'bar', baz: 1, bar: null },
        attributes: { 'data-foo': 'bar', id: 'wat' },
      });

      assert.strictEqual(
        invocation,
        '<TestComponent @foo={{bar}} @baz={{1}} @bar={{null}} data-foo=bar id=wat>World</TestComponent>'
      );
    });

    test('Can build basic component invocation with custom tag name', (assert) => {
      renderTests['testType'] = 'TemplateOnly';
      let invocation = renderTests.buildComponent({
        name: 'Lol',
        layout: 'Hello {{yield}}',
        template: 'World',
        args: { foo: 'bar', baz: 1, bar: null },
        attributes: { 'data-foo': '"bar"', id: '"wat"' },
      });

      assert.strictEqual(
        invocation,
        `<Lol @foo={{bar}} @baz={{1}} @bar={{null}} data-foo="bar" id="wat">World</Lol>`
      );
    });

    test('Can build basic component invocation with block params', (assert) => {
      renderTests['testType'] = 'TemplateOnly';
      let invocation = renderTests.buildComponent({
        name: 'Lol',
        layout: 'Hello {{yield}}',
        template: 'World',
        args: { foo: 'bar', baz: 1, bar: null },
        attributes: { 'data-foo': '"bar"', id: '"wat"' },
        blockParams: ['a b c'],
      });

      assert.strictEqual(
        invocation,
        `<Lol @foo={{bar}} @baz={{1}} @bar={{null}} data-foo="bar" id="wat" as |a b c|>World</Lol>`
      );
    });
  }
);
