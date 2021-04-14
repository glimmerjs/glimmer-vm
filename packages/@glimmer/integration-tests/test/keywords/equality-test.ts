import { RenderTest, test, jitSuite, defineComponent, trackedObj } from '../..';

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
    let args = trackedObj({ foo: 123, bar: 456 });

    const AComponent = defineComponent({}, '{{eq @foo @bar}}');
    this.renderComponent(AComponent, args);

    this.assertHTML('false');

    args.foo = 456;
    this.rerender();

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
    let args = trackedObj({ foo: 123, bar: 456 });

    const AComponent = defineComponent({}, '{{neq @foo @bar}}');
    this.renderComponent(AComponent, args);

    this.assertHTML('true');

    args.foo = 456;
    this.rerender({ foo: 456 });

    this.assertHTML('false');
  }
}

jitSuite(EqualTest);
jitSuite(NotEqualTest);
