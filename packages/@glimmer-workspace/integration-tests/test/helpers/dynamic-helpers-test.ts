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
    let Bar = defineComponent({ foo }, '{{this.helper (foo)}}', {
      definition: ComponentWithHelperField(bar),
    });

    this.renderComponent(Bar);
    this.assertHTML('Hello, world!');
    this.assertStableRerender();
  }

  @test
  'Can use a dynamic helper with nested dynamic helpers'() {
    let foo = defineSimpleHelper(() => {
      return 'world!';
    });
    let bar = defineSimpleHelper((value: string) => 'Hello, ' + value);
    let Bar = defineComponent({}, '{{this.second (this.first)}}', {
      definition: ComponentWithNestedHelperCalls(foo, bar),
    });

    this.renderComponent(Bar);
    this.assertHTML('Hello, world!');
    this.assertStableRerender();
  }
}

function ComponentWithHelperField(helper: (input: string) => string) {
  return class SimpleComponent extends GlimmerishComponent {
    helper = helper;
  };
}

function ComponentWithNestedHelperCalls(first: () => string, second: (value: string) => string) {
  return class SimpleComponent extends GlimmerishComponent {
    first = first;
    second = second;
  };
}

jitSuite(DynamicHelpersResolutionModeTest);
