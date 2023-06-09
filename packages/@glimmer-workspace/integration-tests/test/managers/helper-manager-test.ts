import type { Arguments, Owner } from '@glimmer/interfaces';
import { helperCapabilities, setHelperManager, setModifierManager } from '@glimmer/manager';

import {
  defineComponent,
  GlimmerishComponent,
  jitSuite,
  RenderTest,
  test,
  TestHelper,
  TestHelperManager,
  tracked,
  trackedObj,
} from '../..';
import { trackedCell, type TrackedCell } from '@glimmer/validator';

class HelperManagerTest extends RenderTest {
  static suiteName = 'Helper Managers';

  @test 'it works'() {
    class Hello extends TestHelper {
      value() {
        return 'hello';
      }
    }

    let Main = defineComponent({ hello: Hello }, '{{hello}}');

    this.renderComponent(Main);

    this.assertHTML('hello');

    this.rerender();

    this.assertHTML('hello');
  }

  @test
  '(Default Helper Manager) plain functions work as helpers'(assert: Assert) {
    let count = 0;

    let hello = () => {
      count++;
      return 'plain function';
    };

    let Main = defineComponent({ hello }, '{{hello}}');

    this.renderComponent(Main);

    assert.strictEqual(count, 1, 'rendered once');
    this.assertHTML('plain function');

    this.rerender();

    assert.strictEqual(count, 1, 'rendered once');
    this.assertHTML('plain function');
  }

  @test
  '(Default Helper Manager) plain functions passed as component arguments work as helpers'(
    assert: Assert
  ) {
    let count = 0;

    let hello = () => {
      count++;
      return 'plain function';
    };

    let Main = defineComponent({}, '{{(@hello)}}');

    this.renderComponent(Main, {
      hello,
    });

    assert.strictEqual(count, 1, 'rendered once');
    this.assertHTML('plain function');

    this.rerender();

    assert.strictEqual(count, 1, 'rendered once');
    this.assertHTML('plain function');
  }

  @test
  '(Default Helper Manager) plain functions stored on component class properties work as helpers'(
    assert: Assert
  ) {
    let count = 0;

    let Main = defineComponent({}, '{{(this.hello)}}', {
      definition: class extends GlimmerishComponent {
        hello = () => {
          count++;
          return 'plain function';
        };
      },
    });

    this.renderComponent(Main);

    assert.strictEqual(count, 1, 'rendered once');
    this.assertHTML('plain function');

    this.rerender();

    assert.strictEqual(count, 1, 'rendered once');
    this.assertHTML('plain function');
  }

  @test
  '(Default Helper Manager) plain functions track positional args'(assert: Assert) {
    let count = 0;

    let obj = (x: string) => {
      count++;
      return x;
    };
    let args = trackedObj({ value: 'hello', unused: 'unused' });

    this.renderComponent(defineComponent({ obj }, '{{obj @value @unused}}'), args);

    assert.strictEqual(count, 1, 'rendered once');
    this.assertHTML('hello');

    args['value'] = 'there';
    this.rerender();

    assert.strictEqual(count, 2, 'rendered twice');
    this.assertHTML('there');

    args['unused'] = 'unused2';
    this.rerender();

    assert.strictEqual(count, 3, 'rendered thrice');
    this.assertHTML('there');
  }

  @test
  '(Default Helper Manager) plain functions entangle with any tracked data'(assert: Assert) {
    let count = 0;
    let trackedState = trackedObj({ value: 'hello' });

    let obj = () => {
      count++;
      return trackedState['value'];
    };

    this.renderComponent(defineComponent({ obj }, '{{obj}}'));

    assert.strictEqual(count, 1, 'rendered once');
    this.assertHTML('hello');

    trackedState['value'] = 'there';
    this.rerender();
    this.assertHTML('there');
    assert.strictEqual(count, 2, 'rendered twice');
  }

  @test
  '(Default Helper Manager) plain functions do not track unused named args'(assert: Assert) {
    let count = 0;

    let obj = (x: string, _options: Record<string, unknown>) => {
      count++;
      return x;
    };
    let args = trackedObj({ value: 'hello', unused: 'unused' });

    this.renderComponent(defineComponent({ obj }, '{{obj @value namedOpt=@unused}}'), args);
    assert.strictEqual(count, 1, 'rendered once');
    this.assertHTML('hello');

    args['unused'] = 'unused2';
    this.rerender();

    assert.strictEqual(count, 1, 'rendered once');
    this.assertHTML('hello');
  }

  @test
  '(Default Helper Manager) plain functions tracked used named args'(assert: Assert) {
    let count = 0;

    let obj = (_x: string, options: Record<string, unknown>) => {
      count++;
      return options['namedOpt'];
    };

    let args = trackedObj({ value: 'hello', used: 'used' });

    this.renderComponent(defineComponent({ obj }, '{{obj @value namedOpt=@used}}'), args);
    assert.strictEqual(count, 1, 'rendered once');
    this.assertHTML('used');

    args['used'] = 'there';
    this.rerender();

    assert.strictEqual(count, 2, 'rendered twice');
    this.assertHTML('there');
  }

  @test
  '(Default Helper Manager) plain function helpers can have default values (missing data)'(
    assert: Assert
  ) {
    let count = 0;
    let obj = (x = 'default value') => {
      count++;
      return x;
    };

    let args = trackedObj({});

    this.renderComponent(defineComponent({ obj }, 'result: {{obj}}'), args);
    this.assertHTML('result: default value');
    assert.strictEqual(count, 1, 'rendered once');
  }

  @test
  '(Default Helper Manager) plain function helpers can have overwritten default values'(
    assert: Assert
  ) {
    let count = 0;
    let obj = (x = 'default value') => {
      count++;
      return x;
    };

    let args = trackedObj({ value: undefined });

    this.renderComponent(defineComponent({ obj }, 'result: {{obj @value}}'), args);
    this.assertHTML('result: default value');
    assert.strictEqual(count, 1, 'rendered once');

    args['value'] = 'value';
    this.rerender();

    this.assertHTML('result: value');
    assert.strictEqual(count, 2, 'rendered twice');
  }

  @test 'tracks changes to named arguments'(assert: Assert) {
    let count = 0;

    class Hello extends TestHelper {
      value() {
        count++;
        return this.args.named['foo'];
      }
    }

    let args = trackedObj({ foo: 123 });

    this.renderComponent(defineComponent({ hello: Hello }, '{{hello foo=@foo}}'), args);

    assert.strictEqual(count, 1, 'rendered once');
    this.assertHTML('123');

    this.rerender();

    assert.strictEqual(count, 1, 'rendered once');
    this.assertHTML('123');

    args['foo'] = 456;
    this.rerender();

    assert.strictEqual(count, 2, 'rendered twice');
    this.assertHTML('456');
  }

  @test 'tracks changes to positional arguments'(assert: Assert) {
    let count = 0;

    class Hello extends TestHelper {
      value() {
        count++;
        return this.args.positional[0];
      }
    }

    let args = trackedObj({ foo: 123 });

    this.renderComponent(defineComponent({ hello: Hello }, '{{hello @foo}}'), args);

    assert.strictEqual(count, 1, 'rendered once');
    this.assertHTML('123');

    this.rerender();

    assert.strictEqual(count, 1, 'rendered once');
    this.assertHTML('123');

    args['foo'] = 456;
    this.rerender();

    assert.strictEqual(count, 2, 'rendered twice');
    this.assertHTML('456');
  }

  @test 'tracks changes to tracked properties'(assert: Assert) {
    let cell = trackedCell(123);
    this.renderComponent(defineComponent({ hello: TrackedHelper }, '{{hello @mutable}}'), {
      mutable: cell,
    });
    assert.expect(['[tracked] value()']);

    this.assertHTML('123');

    this.rerender();

    this.assertHTML('123');

    let [, set] = cell;
    set(456);
    this.rerender();

    assert.expect(['[tracked] value()']);
    this.assertHTML('456');

    this.destroy();
    assert.expect(['[tracked] willDestroy']);
  }

  @test 'destroyable is associated correctly'(assert: Assert) {
    this.renderComponent(defineComponent({ hello: DestroyableHelper }, '{{hello}}'));

    this.assertHTML('hello');

    this.destroy();

    assert.verifyActions(['[destroyable] willDestroy']);
  }

  @test 'debug name is used for backtracking message'(assert: Assert) {
    assert.throws(() => {
      this.renderComponent(
        defineComponent({ hello: IllegallyMutatingHelperInConstructor }, '{{hello}}')
      );
    }, /You attempted to update `foo` on/u);
  }

  @test 'asserts against using both `hasValue` and `hasScheduledEffect`'(assert: Assert) {
    assert.throws(() => {
      helperCapabilities('3.23', {
        hasValue: true,
        hasScheduledEffect: true,
      });
    }, /You must pass either the `hasValue` OR the `hasScheduledEffect` capability when defining a helper manager. Passing neither, or both, is not permitted./u);
  }

  @test 'asserts requiring either `hasValue` or `hasScheduledEffect`'(assert: Assert) {
    assert.throws(() => {
      helperCapabilities('3.23', {});
    }, /You must pass either the `hasValue` OR the `hasScheduledEffect` capability when defining a helper manager. Passing neither, or both, is not permitted./u);
  }

  @test 'asserts against using `hasScheduledEffect`'(assert: Assert) {
    assert.throws(() => {
      helperCapabilities('3.23', {
        hasScheduledEffect: true,
      });
    }, /The `hasScheduledEffect` capability has not yet been implemented for helper managers. Please pass `hasValue` instead/u);
  }

  @test 'asserts against using incorrect version for capabilities'(assert: Assert) {
    assert.throws(() => {
      helperCapabilities('aoeu' as any, {
        hasScheduledEffect: true,
      });
    }, /Invalid helper manager compatibility specified/u);
  }

  @test 'helper manager and modifier manager can be associated with the same value'() {
    this.renderComponent(defineComponent({ hello: TestModifierHelper() }, '{{hello}}'));

    this.assertHTML('hello');

    this.rerender();

    this.assertHTML('hello');
  }

  @test 'capabilities helper function must be used to generate capabilities'(assert: Assert) {
    setHelperManager((owner) => new OverrideTestHelperManager(owner), EmptyTestHelper);

    assert.throws(() => {
      this.renderComponent(defineComponent({ hello: SimpleTestHelper }, '{{hello}}'));
    }, /Custom helper managers must have a `capabilities` property that is the result of calling the `capabilities\('3.23'\)` \(imported via `import \{ capabilities \} from '@ember\/helper';`\). /u);
  }

  @test
  'custom helpers gives helpful assertion when reading then mutating a tracked value within constructor'(
    assert: Assert
  ) {
    assert.throws(() => {
      this.renderComponent(
        defineComponent({ hello: IllegallyMutatingHelperInConstructor }, '{{hello}}')
      );
    }, /You attempted to update `foo` on /u);
  }

  @test
  'custom helpers gives helpful assertion when reading then mutating a tracked value within value'(
    assert: Assert
  ) {
    assert.throws(() => {
      this.renderComponent(
        defineComponent({ hello: IllegallyMutatingHelperInGetter }, '{{hello}}')
      );
    }, /You attempted to update `foo` on /u);
  }
}

class TrackedHelper extends TestHelper {
  #number: TrackedCell<number>;

  constructor(owner: Owner, args: Arguments & { positional: [TrackedCell<number>] }) {
    super(owner, args);
    this.#number = args.positional[0];
  }

  value() {
    QUnit.assert.action('[tracked] value()');
    let [get] = this.#number;
    return get();
  }

  override willDestroy(): void {
    QUnit.assert.action('[tracked] willDestroy');
  }
}

function TestModifierHelper() {
  class EmptyTestHelper {}

  abstract class TestModifierHelper extends EmptyTestHelper {}

  setModifierManager(() => ({} as any), EmptyTestHelper);

  return class Hello extends TestModifierHelper {
    value() {
      QUnit.assert.action('[modifier] value()');
      return 'hello';
    }
  };
}

class EmptyTestHelper {}

class DestroyableHelper extends TestHelper {
  value() {
    return 'hello';
  }

  override willDestroy() {
    QUnit.assert.action('[destroyable] willDestroy');
  }
}

class SimpleTestHelper extends TestHelper {
  value() {
    return 'hello';
  }
}

class OverrideTestHelperManager extends TestHelperManager {
  override capabilities = {
    hasValue: true,
    hasDestroyable: true,
    hasScheduledEffect: false,
  } as any;
}

class IllegallyMutatingHelperInConstructor extends TestHelper {
  @tracked accessor foo = 123;

  constructor(owner: Owner, args: Arguments) {
    super(owner, args);

    // first read the tracked property

    this.foo;

    // then attempt to update the tracked property
    this.foo = 456;
  }

  value() {
    return this.foo;
  }
}

class IllegallyMutatingHelperInGetter extends TestHelper {
  @tracked accessor foo = 123;

  value() {
    // first read the tracked property

    this.foo;

    // then attempt to update the tracked property
    this.foo = 456;
  }
}

jitSuite(HelperManagerTest);
