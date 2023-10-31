import { jitSuite, RenderTest, test } from '../..';

class LogTest extends RenderTest {
  static suiteName = '{{log}} keyword';

  originalLog?: () => void;
  logCalls: unknown[] = [];

  override readonly beforeEach = () => {
    /* eslint-disable no-console */
    this.originalLog = console.log;
    console.log = (...args: unknown[]) => {
      this.logCalls.push(...args);
      /* eslint-enable no-console */
    };
  };

  override readonly afterEach = () => {
    /* eslint-disable no-console */
    console.log = this.originalLog!;
    /* eslint-enable no-console */
  };

  assertLog(values: unknown[]) {
    this.assertHTML('');
    this.assert.strictEqual(this.logCalls.length, values.length);

    for (let i = 0, len = values.length; i < len; i++) {
      this.assert.strictEqual(this.logCalls[i], values[i]);
    }
  }

  @test
  'correctly logs primitives'() {
    this.render.template(`{{log "one" 1 true}}`);

    this.assertLog(['one', 1, true]);
  }

  @test
  'correctly logs a property'() {
    this.render.template(`{{log this.value}}`, {
      value: 'one',
    });

    this.assertLog(['one']);
  }

  @test
  'correctly logs multiple arguments'() {
    this.render.template(`{{log "my variable:" this.value}}`, {
      value: 'one',
    });

    this.assertLog(['my variable:', 'one']);
  }

  @test
  'correctly logs `this`'() {
    this.render.template(`{{log this}}`);

    this.assertLog([this.self.inner]);
  }

  @test
  'correctly logs as a subexpression'() {
    this.render.template(`{{if (log "one" 1 true) "Hello!"}}`);

    this.assertLog(['one', 1, true]);
  }

  @test
  'correctly logs when values update'() {
    this.render.template(`{{log this.foo}}`, { foo: 123 });

    this.rerender({ foo: 456 });
    this.rerender({ foo: true });

    this.assertLog([123, 456, true]);
  }
}

jitSuite(LogTest);
