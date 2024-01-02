import {
  defineComponent,
  defineSimpleHelper,
  GlimmerishComponent,
  jitSuite,
  RenderTestContext,
  test,
} from '@glimmer-workspace/integration-tests';

class DynamicHelpersResolutionModeTest extends RenderTestContext {
  static suiteName = 'dynamic helpers in resolution mode';

  @test
  'Can invoke a yielded nested helper in resolution mode'() {
    const foo = defineSimpleHelper(() => 'Hello, world!');
    this.register.component('TemplateOnly', 'Bar', '{{#let @x as |x|}}{{x.foo}}{{/let}}');

    this.render.template('<Bar @x={{this.x}} />', { x: { foo } });
    this.assertHTML('Hello, world!');
    this.assertStableRerender();
  }

  @test
  'Can use a dynamic helper with nested helpers'() {
    const foo = defineSimpleHelper(() => 'world!');
    const bar = defineSimpleHelper((value: string) => 'Hello, ' + value);
    const Bar = defineComponent({ foo }, '{{this.bar (foo)}}', {
      definition: class extends GlimmerishComponent {
        bar = bar;
      },
    });

    this.render.component(Bar);
    this.assertHTML('Hello, world!');
    this.assertStableRerender();
  }

  @test
  'Can use a dynamic helper with nested dynamic helpers'() {
    const foo = defineSimpleHelper(() => 'world!');
    const bar = defineSimpleHelper((value: string) => 'Hello, ' + value);
    const Bar = defineComponent({}, '{{this.bar (this.foo)}}', {
      definition: class extends GlimmerishComponent {
        foo = foo;
        bar = bar;
      },
    });

    this.render.component(Bar);
    this.assertHTML('Hello, world!');
    this.assertStableRerender();
  }
}

jitSuite(DynamicHelpersResolutionModeTest);
