import type {
  DeclaredComponentType,
  ExpandType,
  RenderTestState,
} from '@glimmer-workspace/integration-tests';
import { jitSuite, render, RenderTestContext, suite } from '@glimmer-workspace/integration-tests';

@suite('buildComponent')
class BuildComponentTest extends RenderTestContext {
  @render('glimmer') 'Can build basic glimmer invocation'(assert: RenderTestState) {
    let invocation = this.buildComponent({
      layout: 'Hello',
    });

    assert.strictEqual(invocation, '<TestComponent />');
  }

  @render('glimmer') 'Can build glimmer invocation with template'(
    assert: RenderTestState<'glimmer'>
  ) {
    // renderTests['testType'] = 'Glimmer';
    let invocation = this.buildComponent({
      layout: 'Hello {{yield}}',
      template: 'World',
    });

    assertGlimmerInvocation(assert, invocation, '<TestComponent>World</TestComponent>');
  }

  @render('glimmer') 'Can build glimmer invocation with args'(assert: RenderTestState<'glimmer'>) {
    let invocation = this.buildComponent({
      layout: 'Hello {{yield}}',
      template: 'World',
      args: { foo: 'bar', baz: 1, bar: null, literal: "'literal'" },
    });

    assertGlimmerInvocation(
      assert,
      invocation,
      "<TestComponent @foo={{bar}} @baz={{1}} @bar={{null}} @literal='literal'>World</TestComponent>"
    );
  }

  @render('glimmer') 'Can build glimmer invocation with attributes'(assert: RenderTestState) {
    let invocation = this.buildComponent({
      layout: 'Hello {{yield}}',
      template: 'World',
      args: { foo: 'bar', baz: 1, bar: null },
      attributes: { 'data-foo': 'bar', id: 'wat' },
    });

    assert.strictEqual(
      invocation,
      '<TestComponent @foo={{bar}} @baz={{1}} @bar={{null}} data-foo={{bar}} id={{wat}}>World</TestComponent>'
    );
  }

  @render('glimmer') 'Can build glimmer invocation with custom tag name'(assert: RenderTestState) {
    let invocation = this.buildComponent({
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
  }

  @render('glimmer') 'Can build glimmer invocation with block params'(assert: RenderTestState) {
    let invocation = this.buildComponent({
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
  }

  @render('curly') 'Can build basic curly invocation'(assert: RenderTestState<'curly'>) {
    let invocation = this.buildComponent({
      layout: 'Hello',
    });

    assertInvocation(assert, invocation, {
      curly: '{{test-component}}',
      dynamic: '{{component this.componentName}}',
    });
  }

  @render('curly') 'Can build curly invocation with template'(assert: RenderTestState<'curly'>) {
    let invocation = this.buildComponent({
      layout: 'Hello {{yield}}',
      template: 'World',
    });

    assertInvocation(assert, invocation, {
      curly: '{{#test-component}}World{{/test-component}}',
      dynamic: '{{#component this.componentName}}World{{/component}}',
    });
  }

  @render('curly') 'Can build curly invocation with args'(assert: RenderTestState<'curly'>) {
    let invocation = this.buildComponent({
      layout: 'Hello {{yield}}',
      template: 'World',
      args: { foo: 'bar', baz: 1, bar: null },
    });

    assertInvocation(assert, invocation, {
      curly: '{{#test-component foo=bar baz=1 bar=null}}World{{/test-component}}',
      dynamic: '{{#component this.componentName foo=bar baz=1 bar=null}}World{{/component}}',
    });
  }

  @render('curly') 'Can build curly invocation with attributes throws'(assert: RenderTestState) {
    assert.throws(() => {
      this.buildComponent({
        layout: 'Hello {{yield}}',
        template: 'World',
        args: { foo: 'bar', baz: 1, bar: null },
        attributes: { 'data-foo': '"bar"', id: '"wat"' },
      });
    }, /Cannot pass attributes to curly components/u);
  }

  @render('curly') "Can build curly invocation with 'attributes' in args"(
    assert: RenderTestState<'curly'>
  ) {
    let invocation = this.buildComponent({
      layout: 'Hello {{yield}}',
      template: 'World',
      args: { foo: 'bar', baz: 1, bar: null, 'data-foo': '"bar"', id: '"wat"' },
    });

    assertInvocation(assert, invocation, {
      curly:
        '{{#test-component foo=bar baz=1 bar=null data-foo="bar" id="wat"}}World{{/test-component}}',
      dynamic:
        '{{#component this.componentName foo=bar baz=1 bar=null data-foo="bar" id="wat"}}World{{/component}}',
    });
  }

  @render('curly') 'Can build curly invocation with custom tag name'(
    assert: RenderTestState<'curly'>
  ) {
    let invocation = this.buildComponent({
      name: 'lol-wat',
      layout: 'Hello {{yield}}',
      template: 'World',
      args: { foo: 'bar', baz: 1, bar: null, 'data-foo': '"bar"', id: '"wat"' },
    });

    assertInvocation(assert, invocation, {
      curly: '{{#lol-wat foo=bar baz=1 bar=null data-foo="bar" id="wat"}}World{{/lol-wat}}',
      dynamic:
        '{{#component this.componentName foo=bar baz=1 bar=null data-foo="bar" id="wat"}}World{{/component}}',
    });
  }

  @render('curly') 'Can build curly invocation with block params'(
    assert: RenderTestState<'curly'>
  ) {
    let invocation = this.buildComponent({
      name: 'lol-wat',
      layout: 'Hello {{yield}}',
      template: 'World',
      args: { foo: 'bar', baz: 1, bar: null, 'data-foo': '"bar"', id: '"wat"' },
      blockParams: ['a b c'],
    });

    assertInvocation(assert, invocation, {
      curly:
        '{{#lol-wat foo=bar baz=1 bar=null data-foo="bar" id="wat" as |a b c|}}World{{/lol-wat}}',
      dynamic:
        '{{#component this.componentName foo=bar baz=1 bar=null data-foo="bar" id="wat" as |a b c|}}World{{/component}}',
    });
  }

  @render('curly') 'Can build curly invocation with else'(assert: RenderTestState<'curly'>) {
    let invocation = this.buildComponent({
      name: 'lol-wat',
      layout: 'Hello {{yield}}',
      template: 'World',
      args: { foo: 'bar', baz: 1, bar: null, 'data-foo': '"bar"', id: '"wat"' },
      blockParams: ['a b c'],
      else: 'ELSE',
    });

    assertInvocation(assert, invocation, {
      curly:
        '{{#lol-wat foo=bar baz=1 bar=null data-foo="bar" id="wat" as |a b c|}}World{{else}}ELSE{{/lol-wat}}',
      dynamic:
        '{{#component this.componentName foo=bar baz=1 bar=null data-foo="bar" id="wat" as |a b c|}}World{{else}}ELSE{{/component}}',
    });
  }

  @render('dynamic') 'Can build basic dynamic invocation'(assert: RenderTestState<'dynamic'>) {
    let invocation = this.buildComponent({
      layout: 'Hello',
    });

    assertInvocation(assert, invocation, {
      dynamic: '{{component this.componentName}}',
    });
  }

  @render('dynamic') 'Can build dynamic invocation with template'(
    assert: RenderTestState<'dynamic'>
  ) {
    let invocation = this.buildComponent({
      layout: 'Hello {{yield}}',
      template: 'World',
    });

    assertInvocation(assert, invocation, {
      dynamic: '{{#component this.componentName}}World{{/component}}',
    });
  }

  @render('dynamic') 'Can build dynamic invocation with args'(assert: RenderTestState) {
    let invocation = this.buildComponent({
      layout: 'Hello {{yield}}',
      template: 'World',
      args: { foo: 'bar', baz: 1, bar: null },
    });

    assert.strictEqual(
      invocation,
      '{{#component this.componentName foo=bar baz=1 bar=null}}World{{/component}}'
    );
  }

  @render('dynamic') 'Can build dynamic invocation with custom tag name'(assert: RenderTestState) {
    let invocation = this.buildComponent({
      name: 'lol-wat',
      layout: 'Hello {{yield}}',
      template: 'World',
      args: { foo: 'bar', baz: 1, bar: null, 'data-foo': '"bar"', id: '"wat"' },
    });

    assert.strictEqual(
      invocation,
      `{{#component this.componentName foo=bar baz=1 bar=null data-foo="bar" id="wat"}}World{{/component}}`
    );
  }

  @render('dynamic') 'Can build dynamic invocation with block params'(assert: RenderTestState) {
    let invocation = this.buildComponent({
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
  }

  @render('dynamic') 'Can build dynamic invocation with else'(assert: RenderTestState) {
    let invocation = this.buildComponent({
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
  }

  @render('templateOnly') 'Can build basic component invocation'(assert: RenderTestState) {
    let invocation = this.buildComponent({
      layout: 'Hello',
    });

    assert.strictEqual(invocation, '<TestComponent />');
  }

  @render('templateOnly') 'Can build basic component invocation with template'(
    assert: RenderTestState
  ) {
    let invocation = this.buildComponent({
      layout: 'Hello {{yield}}',
      template: 'World',
    });

    assert.strictEqual(invocation, '<TestComponent>World</TestComponent>');
  }

  @render('templateOnly') 'Can build basic component invocation with args'(
    assert: RenderTestState
  ) {
    let invocation = this.buildComponent({
      layout: 'Hello {{yield}}',
      template: 'World',
      args: { foo: 'bar', baz: 1, bar: null },
    });

    assert.strictEqual(
      invocation,
      '<TestComponent @foo={{bar}} @baz={{1}} @bar={{null}}>World</TestComponent>'
    );
  }

  @render('templateOnly') 'Can build basic component invocation with attributes'(
    assert: RenderTestState
  ) {
    let invocation = this.buildComponent({
      layout: 'Hello {{yield}}',
      template: 'World',
      args: { foo: 'bar', baz: 1, bar: null },
      attributes: { 'data-foo': 'bar', id: 'wat' },
    });

    assert.strictEqual(
      invocation,
      '<TestComponent @foo={{bar}} @baz={{1}} @bar={{null}} data-foo={{bar}} id={{wat}}>World</TestComponent>'
    );
  }

  @render('templateOnly') 'Can build basic component invocation with custom tag name'(
    assert: RenderTestState
  ) {
    let invocation = this.buildComponent({
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
  }

  @render('templateOnly') 'Can build basic component invocation with block params'(
    assert: RenderTestState
  ) {
    let invocation = this.buildComponent({
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
  }
}

jitSuite(BuildComponentTest);

function assertInvocation<K extends Exclude<DeclaredComponentType, 'glimmer'>>(
  context: RenderTestState<K, K>,
  invocation: string,
  all: Record<ExpandType<K>, string>
) {
  context.strictEqual(invocation, all[context.types.invoker]);
}

function assertGlimmerInvocation(
  context: RenderTestState<'glimmer'>,
  actual: string,
  expected: string
) {
  context.strictEqual(actual, expected);
}
