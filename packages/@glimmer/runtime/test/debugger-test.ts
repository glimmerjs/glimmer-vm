import {
  Simple,
  Template,
  IteratorResult,
  RenderResult,
  setDebuggerCallback,
  resetDebuggerCallback
} from "@glimmer/runtime";
import {
  TestEnvironment,
  TestDynamicScope
} from "@glimmer/test-helpers";
import { UpdatableReference } from "@glimmer/object-reference";
import { Opaque } from '@glimmer/util';

let env: TestEnvironment, root: Simple.Element, result: RenderResult, self: UpdatableReference<Opaque>;

function rootElement() {
  return env.getDOM().createElement('div');
}

function compile(template: string) {
  return env.compile(template);
}

function commonSetup() {
  env = new TestEnvironment(); // TODO: Support SimpleDOM
  root = rootElement();
}

function render<T>(template: Template<T>, context={}) {
  self = new UpdatableReference(context);
  env.begin();
  let templateIterator = template.render(self, root, new TestDynamicScope());
  let iteratorResult: IteratorResult<RenderResult>;
  do {
    iteratorResult = templateIterator.next();
  } while (!iteratorResult.done);

  result = iteratorResult.value;
  env.commit();
  return result;
}

QUnit.module("Debugger", {
  beforeEach: commonSetup,
  afterEach() {
    resetDebuggerCallback();
  }
});

QUnit.test('basic debugger statement', assert => {
  let template = compile(`{{debugger}}`);

  setDebuggerCallback((context: any, get) => {
    assert.equal(context.foo, 'bar');
    assert.ok(context.a.b.c);
    assert.equal(get('foo'), 'bar');
    assert.ok(get('a.b.c'));
  });

  render(template, {
    foo: 'bar',
    a: {
      b: {
        c: true
      }
    }
  });
});

QUnit.test('can get locals', assert => {
  let template = compile(`{{#with foo as |bar|}}{{debugger}}{{/with}}`);

  setDebuggerCallback((context: any, get) => {
    assert.equal(get('foo'), 'woot');
    assert.equal(get('bar'), 'woot');
    assert.deepEqual(get('this'), context);
  });

  render(template, {
    foo: 'woot'
  });
});
