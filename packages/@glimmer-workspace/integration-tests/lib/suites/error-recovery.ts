import { RenderTest } from '../render-test';
import { test } from '../test-decorator';

export class ErrorRecoverySuite extends RenderTest {
  static suiteName = 'ErrorRecovery';

  afterEach() {}

  @test
  'if no error is thrown, everything works as expected'() {
    const actions = new Actions();

    this.render('{{#-try}}message: {{this.message}}{{/-try}}', {
      message: 'hello',
    });

    actions.expect([]);
  }

  @test({ kind: 'templateOnly' })
  'if no error is thrown and a component is rendered, everything works as expected'() {
    this.delegate.registerComponent('Glimmer', 'TemplateOnly', 'Message', '{{yield}}');

    this.render('{{#-try}}message: <Message />>{{/-try}}', {});
  }

  @test
  'by default, errors are rethrown and DOM is cleaned up'() {
    const actions = new Actions();

    class Woops {
      get woops() {
        actions.record('get woops');
        throw Error('woops');
      }
    }

    this.render('{{#-try}}message: [{{this.woops.woops}}]{{/-try}}', {
      woops: new Woops(),
    });

    actions.expect(['get woops']);
    this.#assertRenderError('woops');

    // this.rerender();

    // actions.expect(['get woops']);
    // this.assertRenderError('woops');
  }

  // @test
  // 'errors are rethrown during initial render and DOM is cleaned up'() {
  //   const actions = new Actions();

  //   class Counter {
  //     @tracked count = 0;

  //     get message() {
  //       actions.record(`get message`);
  //       if (this.count === 0) {
  //         throw Error('woops');
  //       } else {
  //         return String(this.count);
  //       }
  //     }
  //   }

  //   let counter = new Counter();

  //   this.render('message: [{{this.counter.message}}]', {
  //     counter,
  //   });
  //   this.#assertRenderError('woops');

  //   actions.expect(['get message']);

  //   // counter.count++;

  //   // this.rerender();

  //   // this.assertHTML('message: [1]');
  //   // actions.expect(['get message']);
  // }

  // @test
  // 'errors are rethrown during rerender and DOM is cleaned up'() {
  //   const actions = new Actions();

  //   class Counter {
  //     @tracked count = 0;

  //     get message() {
  //       actions.record(`get message`);
  //       if (this.count === 1) {
  //         throw Error('woops');
  //       } else {
  //         return String(this.count);
  //       }
  //     }
  //   }

  //   let counter = new Counter();

  //   this.render('message: [{{this.counter.message}}]', {
  //     counter,
  //   });

  //   this.assertHTML('message: [0]');
  //   actions.expect(['get message']);

  //   // counter.count++;

  //   // this.rerender();

  //   // this.#assertRenderError('woops');

  //   // actions.expect(['get message']);

  //   // counter.count++;

  //   // this.rerender();

  //   // this.assertHTML('message: [2]');
  //   // actions.expect(['get message']);
  // }

  // @test
  // 'helper destructors run on rollback'(assert: Assert) {
  //   assert.false(true, 'TODO');
  // }

  // @test
  // 'the tracking frame is cleared when an error was thrown'(assert: Assert) {
  //   assert.false(true, 'TODO');
  // }

  #assertRenderError(message: string) {
    if (this.renderResult === null) {
      this.assert.ok(
        null,
        `expecting a RenderResult but didn't have one. Did you call this.render()`
      );
      return;
    }

    if (this.renderResult.error === null) {
      this.assert.ok(null, `expecting a render error, but none was found`);
      return;
    }

    let error = this.renderResult.error?.error;

    if (error instanceof Error) {
      this.assertHTML('<!---->');
      this.assert.equal(error.message, message);
    } else {
      this.assert.ok(error, `expecting the render error to be a Error object`);
    }
  }
}

class Actions {
  #actions: string[] = [];

  record(action: string) {
    this.#actions.push(action);
  }

  expect(expected: string[]) {
    let actual = this.#actions;
    this.#actions = [];

    QUnit.assert.deepEqual(actual, expected);
  }
}
