import { RenderTest, test, jitSuite, defineComponent } from '../..';

class EqualTest extends RenderTest {
  static suiteName = '{{eq}} keyword';

  @test
  ['it works eq']() {
    const AComponent = defineComponent({}, '{{eq 1 1}}');
    this.renderComponent(AComponent);

    this.assertHTML('true');
  }

  @test
  ['it works multiple arguments eq']() {
    const AComponent = defineComponent({}, '{{eq 1 1 1}}');
    this.renderComponent(AComponent);

    this.assertHTML('true');
  }

  @test
  ['it works falsey eq']() {
    const AComponent = defineComponent({}, '{{eq 1 2}}');
    this.renderComponent(AComponent);

    this.assertHTML('false');
  }

  @test
  ['it works multiple arguments falsey eq']() {
    const AComponent = defineComponent({}, '{{eq 1 1 2}}');
    this.renderComponent(AComponent);

    this.assertHTML('false');
  }

  @test
  ['correctly renders when values update eq']() {
    const AComponent = defineComponent({}, '{{eq @foo @bar}}');
    this.renderComponent(AComponent, { foo: 123, bar: 456 });

    this.assertHTML('false');
    this.assertStableRerender();

    this.rerender({ foo: 456 });

    this.assertHTML('true');
  }
}

class NotEqualTest extends RenderTest {
  static suiteName = '{{neq}} keyword';

  @test
  ['it works neq']() {
    const AComponent = defineComponent({}, '{{neq 1 2}}');
    this.renderComponent(AComponent);

    this.assertHTML('true');
  }

  @test
  ['it works multiple arguments neq']() {
    const AComponent = defineComponent({}, '{{neq 1 2 1}}');
    this.renderComponent(AComponent);

    this.assertHTML('true');
  }

  @test
  ['it works falsey neq']() {
    const AComponent = defineComponent({}, '{{neq 1 1}}');
    this.renderComponent(AComponent);

    this.assertHTML('false');
  }

  @test
  ['it works multiple arguments falsey neq']() {
    const AComponent = defineComponent({}, '{{neq 1 1 1}}');
    this.renderComponent(AComponent);

    this.assertHTML('false');
  }

  @test
  ['correctly renders when values update neq']() {
    const AComponent = defineComponent({}, '{{neq @foo @bar}}');
    this.renderComponent(AComponent, { foo: 123, bar: 456 });

    this.assertHTML('true');

    this.rerender({ foo: 456 });

    this.assertHTML('false');
  }
}

jitSuite(EqualTest);
jitSuite(NotEqualTest);
