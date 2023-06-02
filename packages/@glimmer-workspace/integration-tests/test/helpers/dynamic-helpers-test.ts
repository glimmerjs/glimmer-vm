import {
  BrowserRenderTest,
  defineComponent,
  defineSimpleHelper,
  GlimmerishComponent,
  jitSuite,
  test,
} from '@glimmer-workspace/integration-tests';

class DynamicHelpersResolutionModeTest extends BrowserRenderTest {
  static suiteName = 'dynamic helpers in resolution mode';

  @test
  'Can invoke a yielded nested helper in resolution mode'() {
    let foo = defineSimpleHelper(() => 'Hello, world!');
    this.registerComponent('TemplateOnly', 'Bar', '{{#let @x as |x|}}{{x.foo}}{{/let}}');

    this.render('<Bar @x={{this.x}} />', { x: { foo } });
    this.assertHTML('Hello, world!');
    this.assertStableRerender();
  }

  @test
  'Can use a dynamic helper with nested helpers'() {
    let foo = defineSimpleHelper(() => 'world!');
    let bar = defineSimpleHelper((value: string) => 'Hello, ' + value);
    let Bar = defineComponent({ foo }, '{{this.bar (foo)}}', {
      definition: class extends GlimmerishComponent {
        bar = bar;
      },
    });

    this.renderComponent(Bar);
    this.assertHTML('Hello, world!');
    this.assertStableRerender();
  }

  @test
  'Can use a dynamic helper with nested dynamic helpers'() {
    let foo = defineSimpleHelper(() => 'world!');
    let bar = defineSimpleHelper((value: string) => 'Hello, ' + value);
    let Bar = defineComponent({}, '{{this.bar (this.foo)}}', {
      definition: class extends GlimmerishComponent {
        foo = foo;
        bar = bar;
      },
    });

    this.renderComponent(Bar);
    this.assertHTML('Hello, world!');
    this.assertStableRerender();
  }
}

jitSuite(DynamicHelpersResolutionModeTest);
