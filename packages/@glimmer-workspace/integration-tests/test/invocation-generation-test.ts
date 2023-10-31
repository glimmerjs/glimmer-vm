import { RenderTest } from '../lib/render-test';
import {
  RenderTestContext,
  jitSuite,
  type ExpandType,
  type KindFor,
} from '../lib/test-helpers/module';
import { test, suite, type ComponentKind } from '../lib/test-decorator';

@suite('buildComponent')
class BuildComponentTest extends RenderTest {
  @test('glimmer') 'Can build basic glimmer invocation'(assert: RenderTestContext) {
    let invocation = this.buildComponent({
      layout: 'Hello',
    });

    assert.strictEqual(invocation, '<TestComponent />');
  }

  @test('glimmer') 'Can build glimmer invocation with template'(
    assert: RenderTestContext<'glimmer'>
  ) {
    // renderTests['testType'] = 'Glimmer';
    let invocation = this.buildComponent({
      layout: 'Hello {{yield}}',
      template: 'World',
    });

    assertGlimmerInvocation(assert, invocation, '<TestComponent>World</TestComponent>');
  }

  @test('glimmer') 'Can build glimmer invocation with args'(assert: RenderTestContext<'glimmer'>) {
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

  @test('glimmer') 'Can build glimmer invocation with attributes'(assert: RenderTestContext) {
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

  @test('glimmer') 'Can build glimmer invocation with custom tag name'(assert: RenderTestContext) {
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

  @test('glimmer') 'Can build glimmer invocation with block params'(assert: RenderTestContext) {
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

  @test('curly') 'Can build basic curly invocation'(assert: RenderTestContext<'curly'>) {
    let invocation = this.buildComponent({
      layout: 'Hello',
    });

    assertInvocation(assert, invocation, {
      Curly: '{{test-component}}',
      Dynamic: '{{component this.componentName}}',
    });
  }

  @test('curly') 'Can build curly invocation with template'(assert: RenderTestContext<'curly'>) {
    let invocation = this.buildComponent({
      layout: 'Hello {{yield}}',
      template: 'World',
    });

    assertInvocation(assert, invocation, {
      Curly: '{{#test-component}}World{{/test-component}}',
      Dynamic: '{{#component this.componentName}}World{{/component}}',
    });
  }

  @test('curly') 'Can build curly invocation with args'(assert: RenderTestContext<'curly'>) {
    let invocation = this.buildComponent({
      layout: 'Hello {{yield}}',
      template: 'World',
      args: { foo: 'bar', baz: 1, bar: null },
    });

    assertInvocation(assert, invocation, {
      Curly: '{{#test-component foo=bar baz=1 bar=null}}World{{/test-component}}',
      Dynamic: '{{#component this.componentName foo=bar baz=1 bar=null}}World{{/component}}',
    });
  }

  @test('curly') 'Can build curly invocation with attributes throws'(assert: RenderTestContext) {
    assert.throws(() => {
      this.buildComponent({
        layout: 'Hello {{yield}}',
        template: 'World',
        args: { foo: 'bar', baz: 1, bar: null },
        attributes: { 'data-foo': '"bar"', id: '"wat"' },
      });
    }, /Cannot pass attributes to curly components/u);
  }

  @test('curly') "Can build curly invocation with 'attributes' in args"(
    assert: RenderTestContext<'curly'>
  ) {
    let invocation = this.buildComponent({
      layout: 'Hello {{yield}}',
      template: 'World',
      args: { foo: 'bar', baz: 1, bar: null, 'data-foo': '"bar"', id: '"wat"' },
    });

    assertInvocation(assert, invocation, {
      Curly:
        '{{#test-component foo=bar baz=1 bar=null data-foo="bar" id="wat"}}World{{/test-component}}',
      Dynamic:
        '{{#component this.componentName foo=bar baz=1 bar=null data-foo="bar" id="wat"}}World{{/component}}',
    });
  }

  @test('curly') 'Can build curly invocation with custom tag name'(
    assert: RenderTestContext<'curly'>
  ) {
    let invocation = this.buildComponent({
      name: 'lol-wat',
      layout: 'Hello {{yield}}',
      template: 'World',
      args: { foo: 'bar', baz: 1, bar: null, 'data-foo': '"bar"', id: '"wat"' },
    });

    assertInvocation(assert, invocation, {
      Curly: '{{#lol-wat foo=bar baz=1 bar=null data-foo="bar" id="wat"}}World{{/lol-wat}}',
      Dynamic:
        '{{#component this.componentName foo=bar baz=1 bar=null data-foo="bar" id="wat"}}World{{/component}}',
    });
  }

  @test('curly') 'Can build curly invocation with block params'(
    assert: RenderTestContext<'curly'>
  ) {
    let invocation = this.buildComponent({
      name: 'lol-wat',
      layout: 'Hello {{yield}}',
      template: 'World',
      args: { foo: 'bar', baz: 1, bar: null, 'data-foo': '"bar"', id: '"wat"' },
      blockParams: ['a b c'],
    });

    assertInvocation(assert, invocation, {
      Curly:
        '{{#lol-wat foo=bar baz=1 bar=null data-foo="bar" id="wat" as |a b c|}}World{{/lol-wat}}',
      Dynamic:
        '{{#component this.componentName foo=bar baz=1 bar=null data-foo="bar" id="wat" as |a b c|}}World{{/component}}',
    });
  }

  @test('curly') 'Can build curly invocation with else'(assert: RenderTestContext<'curly'>) {
    let invocation = this.buildComponent({
      name: 'lol-wat',
      layout: 'Hello {{yield}}',
      template: 'World',
      args: { foo: 'bar', baz: 1, bar: null, 'data-foo': '"bar"', id: '"wat"' },
      blockParams: ['a b c'],
      else: 'ELSE',
    });

    assertInvocation(assert, invocation, {
      Curly:
        '{{#lol-wat foo=bar baz=1 bar=null data-foo="bar" id="wat" as |a b c|}}World{{else}}ELSE{{/lol-wat}}',
      Dynamic:
        '{{#component this.componentName foo=bar baz=1 bar=null data-foo="bar" id="wat" as |a b c|}}World{{else}}ELSE{{/component}}',
    });
  }

  @test('dynamic') 'Can build basic dynamic invocation'(assert: RenderTestContext<'dynamic'>) {
    let invocation = this.buildComponent({
      layout: 'Hello',
    });

    assertInvocation(assert, invocation, {
      Dynamic: '{{component this.componentName}}',
    });
  }

  @test('dynamic') 'Can build dynamic invocation with template'(
    assert: RenderTestContext<'dynamic'>
  ) {
    let invocation = this.buildComponent({
      layout: 'Hello {{yield}}',
      template: 'World',
    });

    assertInvocation(assert, invocation, {
      Dynamic: '{{#component this.componentName}}World{{/component}}',
    });
  }

  @test('dynamic') 'Can build dynamic invocation with args'(assert: RenderTestContext) {
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

  @test('dynamic') 'Can build dynamic invocation with custom tag name'(assert: RenderTestContext) {
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

  @test('dynamic') 'Can build dynamic invocation with block params'(assert: RenderTestContext) {
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

  @test('dynamic') 'Can build dynamic invocation with else'(assert: RenderTestContext) {
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

  @test('templateOnly') 'Can build basic component invocation'(assert: RenderTestContext) {
    let invocation = this.buildComponent({
      layout: 'Hello',
    });

    assert.strictEqual(invocation, '<TestComponent />');
  }

  @test('templateOnly') 'Can build basic component invocation with template'(
    assert: RenderTestContext
  ) {
    let invocation = this.buildComponent({
      layout: 'Hello {{yield}}',
      template: 'World',
    });

    assert.strictEqual(invocation, '<TestComponent>World</TestComponent>');
  }

  @test('templateOnly') 'Can build basic component invocation with args'(
    assert: RenderTestContext
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

  @test('templateOnly') 'Can build basic component invocation with attributes'(
    assert: RenderTestContext
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

  @test('templateOnly') 'Can build basic component invocation with custom tag name'(
    assert: RenderTestContext
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

  @test('templateOnly') 'Can build basic component invocation with block params'(
    assert: RenderTestContext
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

function assertInvocation<K extends Exclude<ComponentKind, 'glimmer'>>(
  context: RenderTestContext<K>,
  invocation: string,
  all: Record<KindFor<ExpandType<K>>, string>
) {
  context.strictEqual(invocation, all[context.testType]);
}

function assertGlimmerInvocation(
  context: RenderTestContext<'glimmer'>,
  actual: string,
  expected: string
) {
  context.strictEqual(actual, expected);
}
