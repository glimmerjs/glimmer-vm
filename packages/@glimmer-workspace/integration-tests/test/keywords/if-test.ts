import { defineComponent, jitSuite, RenderTest, test, tracked } from '../..';

class InlineIfTest extends RenderTest {
  static suiteName = 'inline {{if}} keyword';

  @test
  'inline if can swap render components'() {
    class State {
      @tracked cond = true;
      flip = () => (this.cond = !this.cond);
    }

    let state = new State();

    const Foo = defineComponent({}, 'Foo');
    const ooF = defineComponent({}, 'ooF');
    const Bar = defineComponent({ Foo, ooF, state }, '{{if state.cond Foo ooF}}');

    this.renderComponent(Bar);

    this.assertHTML('Foo');

    state.flip();
    this.rerender();
    this.assertHTML('ooF');

    state.flip();
    this.rerender();
    this.assertHTML('Foo');
  }
}

jitSuite(InlineIfTest);
