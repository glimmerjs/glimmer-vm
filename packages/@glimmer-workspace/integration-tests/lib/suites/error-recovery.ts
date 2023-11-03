import { render, RenderTestContext, stripTight } from '@glimmer-workspace/integration-tests';

export class ErrorRecoverySuite extends RenderTestContext {
  static suiteName = 'ErrorRecovery';

  @render
  'if no error is thrown, everything works as expected'() {
    const actions = new Actions();

    this.render.template('{{#-try}}message: {{this.message}}{{/-try}}', {
      message: 'hello',
    });

    actions.expect([]);
  }

  @render('templateOnly')
  'if no error is thrown and a component is rendered, everything works as expected'() {
    this.register.component('TemplateOnly', 'Message', '{{yield}}');

    this.render.template('{{#-try}}message: <Message />>{{/-try}}', {});
  }

  @render
  'if the error is handled, the DOM is cleaned up'() {
    const actions = new Actions();

    class Woops {
      get woops() {
        actions.record('get woops');
        throw Error('woops');
      }
    }

    this.render.template('{{#-try this.handler}}message: [{{this.woops.woops}}]{{/-try}}', {
      woops: new Woops(),
      handler: (_err: unknown, _retry: () => void) => {
        // it only runs once
        actions.record('error handled');
      },
    });

    actions.expect(['get woops', 'error handled']);
    this.assertHTML('<!---->');
  }

  @render
  'if the error is unhandled, the DOM is cleaned up'(assert: Assert) {
    const actions = new Actions();

    class Woops {
      get woops() {
        actions.record('get woops');
        throw Error('woops');
      }
    }

    assert.throws(() => {
      this.render.template('{{#-try}}message: [{{this.woops.woops}}]{{/-try}}', {
        woops: new Woops(),
      });
    });

    actions.expect(['get woops']);
    this.assertHTML('<!---->');
  }

  @render
  'error boundaries can happen in nested context'() {
    const actions = new Actions();

    class Woops {
      get woops() {
        actions.record('get woops');
        throw Error('woops');
      }
    }

    this.render.template(
      stripTight`
        <p>
          {{this.outer.before}}|
          {{#-try this.handler}}
            {{this.inner.before}}|message: [{{this.woops.woops}}]|{{this.inner.after}}
          {{/-try}}
          |{{this.outer.after}}
        </p>
      `,
      {
        woops: new Woops(),
        outer: {
          before: 'outer:before',
          after: 'outer:after',
        },
        inner: {
          before: 'inner:before',
          after: 'inner:after',
        },
        handler: (_err: unknown, _retry: () => void) => {
          actions.record('error handled');
        },
      }
    );

    actions.expect(['get woops', 'error handled']);
    this.assertHTML('<p>outer:before||outer:after</p>');
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
