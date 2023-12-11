import {
  defineComponent,
  jitSuite,
  RenderTestContext,
  test,
} from '@glimmer-workspace/integration-tests';

class LexicalScopeTest extends RenderTestContext {
  static suiteName = 'loose mode: lexical scope';

  @test
  'Can use a component in scope'() {
    const Foo = defineComponent({}, 'Hello, world!', { strictMode: false });
    const Bar = defineComponent({ Foo }, '<Foo/>', { strictMode: false });

    this.render.component(Bar);
    this.assertHTML('Hello, world!');
    this.assertStableRerender();
  }
}

jitSuite(LexicalScopeTest);
