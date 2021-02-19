import { RenderTest, test, jitSuite, defineSimpleHelper, defineComponent } from '../..';

class DynamicHelpersResolutionModeTest extends RenderTest {
  static suiteName = 'Helpers as path roots';

  @test
  'Can use a helper as a path root in append position'() {
    const foo = defineSimpleHelper(() => ({ message: 'Hello, world!' }));
    const Foo = defineComponent({ foo }, `{{(foo).message}}`);

    this.renderComponent(Foo);
    this.assertHTML('Hello, world!');
    this.assertStableRerender();
  }

  @test
  'Can use a helper as a path root in argument position'() {
    const foo = defineSimpleHelper(() => ({ message: 'Hello, world!' }));
    const Foo = defineComponent({}, `{{@message}}`);
    const Bar = defineComponent({ Foo, foo }, `<Foo @message={{(foo).message}} />`);

    this.renderComponent(Bar);
    this.assertHTML('Hello, world!');
    this.assertStableRerender();
  }

  @test
  'Can use a helper as a path root in subexression position'() {
    const foo = defineSimpleHelper(() => ({ name: 'world' }));
    const bar = defineSimpleHelper(([name]: string[]) => `Hello, ${name}!`);
    const Foo = defineComponent({ foo, bar }, `{{bar (foo).name}}`);

    this.renderComponent(Foo);
    this.assertHTML('Hello, world!');
    this.assertStableRerender();
  }

  @test
  'Can use a helper as a path root in nested subexression position'() {
    const foo = defineSimpleHelper(() => ({ name: 'Tom' }));
    const isTom = defineSimpleHelper(([str]: string[]) => str === 'Tom');
    const Foo = defineComponent({ foo, isTom }, `{{#if (isTom (foo).name)}}Hello, Tom!{{/if}}`);

    this.renderComponent(Foo);
    this.assertHTML('Hello, Tom!');
    this.assertStableRerender();
  }
}

jitSuite(DynamicHelpersResolutionModeTest);
