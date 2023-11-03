import { resetDebuggerCallback, setDebuggerCallback } from '@glimmer/runtime';

import { RenderTestContext } from '../render-test';
import { render } from '../test-decorator';

export class DebuggerSuite extends RenderTestContext {
  static suiteName = 'Debugger';

  override readonly afterEach = () => {
    resetDebuggerCallback();
  };

  @render
  'basic debugger statement'() {
    let expectedContext = {
      foo: 'bar',
      a: {
        b: true,
      },
    };
    let callbackExecuted = 0;

    setDebuggerCallback((context: any, get) => {
      callbackExecuted++;
      this.assert.strictEqual(context.foo, expectedContext.foo);
      this.assert.strictEqual(get('foo'), expectedContext.foo);
    });

    this.render.template(
      '{{#if this.a.b}}true{{debugger}}{{else}}false{{debugger}}{{/if}}',
      expectedContext
    );
    this.assert.strictEqual(callbackExecuted, 1);
    this.assertHTML('true');
    this.assertStableRerender();

    expectedContext = {
      foo: 'baz',
      a: {
        b: false,
      },
    };
    this.rerender(expectedContext);
    this.assert.strictEqual(callbackExecuted, 2);
    this.assertHTML('false');
    this.assertStableNodes();

    expectedContext = {
      foo: 'bar',
      a: {
        b: true,
      },
    };
    this.rerender(expectedContext);
    this.assert.strictEqual(callbackExecuted, 3);
    this.assertHTML('true');
    this.assertStableNodes();
  }

  @render
  'can get locals'() {
    let expectedContext = {
      foo: 'bar',
      a: {
        b: true,
      },
    };
    let callbackExecuted = 0;

    setDebuggerCallback((context: any, get) => {
      callbackExecuted++;
      this.assert.strictEqual(get('foo'), expectedContext.foo);
      this.assert.strictEqual(get('bar'), expectedContext.foo);
      this.assert.deepEqual(get('this'), context);
    });

    this.render.template(
      '{{#with this.foo as |bar|}}{{#if this.a.b}}true{{debugger}}{{else}}false{{debugger}}{{/if}}{{/with}}',
      expectedContext
    );
    this.assert.strictEqual(callbackExecuted, 1);
    this.assertHTML('true');
    this.assertStableRerender();

    expectedContext = {
      foo: 'baz',
      a: {
        b: false,
      },
    };
    this.rerender(expectedContext);
    this.assert.strictEqual(callbackExecuted, 2);
    this.assertHTML('false');
    this.assertStableNodes();

    expectedContext = {
      foo: 'bar',
      a: {
        b: true,
      },
    };
    this.rerender(expectedContext);
    this.assert.strictEqual(callbackExecuted, 3);
    this.assertHTML('true');
    this.assertStableNodes();
  }
}
