import {
  RenderTest,
  test,
  jitSuite,
  defineComponent,
  preprocess,
  syntaxErrorFor,
  trackedObj,
} from '../..';

class EqualTest extends RenderTest {
  static suiteName = '{{eq}} keyword';

  @test
  ['it works eq']() {
    const AComponent = defineComponent({}, '{{eq 1 1}}');
    this.renderComponent(AComponent);

    this.assertHTML('true');
  }

  @test
  ['it errors if 1 argument eq']() {
    this.assert.throws(() => {
      preprocess(`{{eq 1}}`, { strictMode: true, meta: { moduleName: 'test-module' } });
    }, syntaxErrorFor('(eq) must receive two positional parameters. Received 1 parameters.', `{{eq 1}}`, 'test-module', 1, 0));
  }

  @test
  ['it errors if more than 2 arguments eq']() {
    this.assert.throws(() => {
      preprocess(`{{eq 1 1 1}}`, { strictMode: true, meta: { moduleName: 'test-module' } });
    }, syntaxErrorFor('(eq) must receive two positional parameters. Received 3 parameters.', `{{eq 1 1 1}}`, 'test-module', 1, 0));
  }

  @test
  ['it works falsey eq']() {
    const AComponent = defineComponent({}, '{{eq 1 2}}');
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
  ['it errors if 1 argument neq']() {
    this.assert.throws(() => {
      preprocess(`{{neq 1}}`, { strictMode: true, meta: { moduleName: 'test-module' } });
    }, syntaxErrorFor('(neq) must receive two positional parameters. Received 1 parameters.', `{{neq 1}}`, 'test-module', 1, 0));
  }

  @test
  ['it errors if more than 2 arguments neq']() {
    this.assert.throws(() => {
      preprocess(`{{neq 1 1 1}}`, { strictMode: true, meta: { moduleName: 'test-module' } });
    }, syntaxErrorFor('(neq) must receive two positional parameters. Received 3 parameters.', `{{neq 1 1 1}}`, 'test-module', 1, 0));
  }

  @test
  ['it works falsey neq']() {
    const AComponent = defineComponent({}, '{{neq 1 1}}');
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
