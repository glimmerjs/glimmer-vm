import { defineComponent, jitSuite, RenderTest, test } from '..';

class LexicalScopeTest extends RenderTest {
  static suiteName = 'loose mode: lexical scope';

  @test
  'Can use a component in scope'() {
    let Foo = defineComponent({}, 'Hello, world!', { strictMode: false });
    let Bar = defineComponent({ Foo }, '<Foo/>', { strictMode: false });

    this.renderComponent(Bar);
    this.assertHTML('Hello, world!');
    this.assertStableRerender();
  }
}

jitSuite(LexicalScopeTest);
