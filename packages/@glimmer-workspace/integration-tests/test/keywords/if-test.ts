import { defineComponent, jitSuite, RenderTest, test, tracked } from '../..';

class LogTest extends RenderTest {
  static suiteName = '{{log}} keyword';

  originalLog?: () => void;
  logCalls: unknown[] = [];

  beforeEach() {
    /* eslint-disable no-console */
    this.originalLog = console.log;
    console.log = (...args: unknown[]) => {
      this.logCalls.push(...args);
      /* eslint-enable no-console */
    };
  }

  afterEach() {
    /* eslint-disable no-console */
    console.log = this.originalLog!;
    /* eslint-enable no-console */
  }

  assertLog(values: unknown[]) {
    this.assertHTML('');
    this.assert.strictEqual(this.logCalls.length, values.length);

    for (let i = 0, len = values.length; i < len; i++) {
      this.assert.strictEqual(this.logCalls[i], values[i]);
    }
  }

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

jitSuite(LogTest);
