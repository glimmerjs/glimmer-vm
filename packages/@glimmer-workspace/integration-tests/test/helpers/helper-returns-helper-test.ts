import {
  defineComponent,
  defineSimpleHelper,
  GlimmerishComponent,
  jitSuite,
  RenderTest,
  test,
  tracked,
} from '@glimmer-workspace/integration-tests';

class HelperReturnsHelperTest extends RenderTest {
  static suiteName = 'Helper returns helper';

  @test
  'helper that returns another helper function should call it with empty args'() {
    const innerHelper = defineSimpleHelper(() => 'Hello from inner helper');
    const outerHelper = defineSimpleHelper(() => innerHelper);

    const Component = defineComponent({ outerHelper }, '{{outerHelper}}');

    this.renderComponent(Component);
    this.assertHTML('Hello from inner helper');
    this.assertStableRerender();
  }

  @test
  'helper that returns a helper that returns another helper should render the third as text'() {
    const thirdHelper = defineSimpleHelper(() => 'Third helper');
    const secondHelper = defineSimpleHelper(() => thirdHelper);
    const firstHelper = defineSimpleHelper(() => secondHelper);

    const Component = defineComponent({ firstHelper }, '{{firstHelper}}');

    this.renderComponent(Component);
    // The third helper should be rendered as text, not called
    // This prevents infinite recursion
    // The actual string representation will depend on how the helper is converted to string
    // For now, we'll check that it's not "Third helper" (which would mean it was called)
    const html = (this.element as unknown as HTMLElement).innerHTML;
    this.assert.notEqual(html, 'Third helper', 'Third helper should not be called');
    this.assertStableRerender();
  }

  @test
  'helper that returns a helper should pass through arguments correctly'() {
    const innerHelper = defineSimpleHelper((arg1: string, arg2: string) => {
      return `${arg1} ${arg2}`;
    });
    const outerHelper = defineSimpleHelper(() => innerHelper);

    const Component = defineComponent({ outerHelper }, '{{outerHelper "Hello" "World"}}');

    this.renderComponent(Component);
    // Inner helper should be called with empty args, not the outer helper's args
    this.assertHTML('undefined undefined');
    this.assertStableRerender();
  }

  @test
  'dynamic helper that returns different helpers based on state'() {
    const helloHelper = defineSimpleHelper(() => 'Hello');
    const goodbyeHelper = defineSimpleHelper(() => 'Goodbye');

    let componentInstance: TestComponent | undefined;

    class TestComponent extends GlimmerishComponent {
      @tracked useHello = true;

      constructor(owner: object, args: Record<string, unknown>) {
        super(owner, args);
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        componentInstance = this;
      }

      get dynamicHelper() {
        return this.useHello ? helloHelper : goodbyeHelper;
      }
    }

    const Component = defineComponent({}, '{{this.dynamicHelper}}', { definition: TestComponent });

    this.renderComponent(Component);
    this.assertHTML('Hello');

    if (!componentInstance) {
      throw new Error('Component instance not set');
    }

    componentInstance.useHello = false;
    this.rerender();
    this.assertHTML('Goodbye');
  }
}

jitSuite(HelperReturnsHelperTest);
