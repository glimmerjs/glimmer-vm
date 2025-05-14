import type { Dict, Owner } from '@glimmer/interfaces';
import { trackedArray } from '@glimmer/validator';
import {
  defineComponent,
  GlimmerishComponent as Component,
  jitSuite,
  RenderTest,
  test,
} from '@glimmer-workspace/integration-tests';

const ARRAY_GETTER_METHODS = [
  'concat',
  'entries',
  'every',
  'filter',
  'find',
  'findIndex',
  'flat',
  'flatMap',
  'forEach',
  'includes',
  'indexOf',
  'join',
  'keys',
  'lastIndexOf',
  'map',
  'reduce',
  'reduceRight',
  'slice',
  'some',
  'values',
];

const ARRAY_SETTER_METHODS = [
  'copyWithin',
  'fill',
  'pop',
  'push',
  'reverse',
  'shift',
  'sort',
  'splice',
  'unshift',
];

class TrackedArrayTest extends RenderTest {
  static suiteName = `trackedArray() (rendering)`;

  @test
  'options.equals: default equals does not dirty on no-op changes'(assert: Assert) {
    const obj = trackedArray(['foo', '123']);
    const step = (index: number) => {
      assert.step(String(obj[index]));
      return obj[index];
    };

    const Foo = defineComponent({ step, obj }, '{{ (step 0) }} {{ (step 1) }}');

    this.renderComponent(Foo);

    this.assertHTML('foo 123');
    assert.verifySteps(['foo', '123']);

    obj[0] = 'foo';
    this.rerender();

    this.assertHTML('foo 123');
    this.assertStableRerender();
    assert.verifySteps([]);
  }

  @test
  'options.equals: using equals can dirty on every change'(assert: Assert) {
    const obj = trackedArray(['foo', '123'], { equals: () => false });
    const step = (index: number) => {
      assert.step(String(obj[index]));
      return obj[index];
    };

    const Foo = defineComponent({ step, obj }, '{{ (step 0) }} {{ (step 1) }}');

    this.renderComponent(Foo);

    this.assertHTML('foo 123');
    assert.verifySteps(['foo', '123']);

    obj[0] = 'foo';
    this.rerender();

    this.assertHTML('foo 123');
    this.assertStableRerender();
    assert.verifySteps(['foo']);
  }

  @test
  'getting and setting an index'() {
    this.assertReactivity(
      class extends Component {
        arr = trackedArray(['foo']);

        get value() {
          return this.arr[0];
        }

        update() {
          this.arr[0] = 'bar';
        }
      }
    );
  }

  @test
  'Can push into a newly created TrackedArray during construction'() {
    this.assertReactivity(
      class extends Component {
        arr = trackedArray();

        constructor(owner: Owner, args: Dict) {
          super(owner, args);
          this.arr.push('hello');
        }

        get value() {
          return this.arr[0];
        }

        update() {
          this.arr[0] = 'goodbye';
        }
      }
    );
  }

  @test
  'Can unshift into a newly created TrackedArray during construction'() {
    this.assertReactivity(
      class extends Component {
        arr = trackedArray();

        constructor(owner: Owner, args: Dict) {
          super(owner, args);
          this.arr.unshift('hello');
        }

        get value() {
          return this.arr[0];
        }

        update() {
          this.arr[0] = 'goodbye';
        }
      }
    );
  }

  @test
  '{{each}} works with new items'() {
    this.assertEachReactivity(
      class extends Component {
        collection = trackedArray([1, 2, 3]);

        update() {
          this.collection.push(4);
        }
      }
    );
  }

  @test
  '{{each}} works when updating old items'() {
    this.assertEachReactivity(
      class extends Component {
        collection = trackedArray([1, 2, 3]);

        update() {
          this.collection[2] = 5;
        }
      }
    );
  }

  @test({ skip: true })
  '{{each-in}} works with new items'() {
    this.assertEachInReactivity(
      class extends Component {
        collection = trackedArray([1, 2, 3]);

        update() {
          this.collection.push(4);
        }
      }
    );
  }

  @test({ skip: true })
  '{{each-in}} works when updating old items'() {
    this.assertEachInReactivity(
      class extends Component {
        collection = trackedArray([1, 2, 3]);

        update() {
          this.collection[2] = 5;
        }
      }
    );
  }

  @test
  ARRAY_GETTER_METHODS() {
    ARRAY_GETTER_METHODS.forEach((method) => {
      this.assertReactivity(
        class extends Component {
          arr = trackedArray(['foo', 'bar']);

          get value() {
            // @ts-expect-error -- this can't be represented easily in TS, and we
            // don't actually care that it is; we're *just* testing reactivity.
            return this.arr[method](() => {
              /* no op */
            });
          }

          update() {
            this.arr[0] = 'bar';
          }
        },
        true,
        `[[${method} individual index]]`
      );

      this.assertReactivity(
        class extends Component {
          arr = trackedArray(['foo', 'bar'], { equals: () => false });

          get value() {
            // @ts-expect-error -- this can't be represented easily in TS, and we
            // don't actually care that it is; we're *just* testing reactivity.
            return this.arr[method](() => {
              /* no op */
            });
          }

          update() {
            this.arr[0] = 'bar';
          }
        },
        true,
        `[[${method} individual index via reference equality (no Object.is) -- tracked-built-ins behavior]]`
      );

      this.assertReactivity(
        class extends Component {
          arr = trackedArray([{ foo: 'bar' }], { equals: (a, b) => a.foo === b.foo });

          get value() {
            // @ts-expect-error -- this can't be represented easily in TS, and we
            // don't actually care that it is; we're *just* testing reactivity.
            return this.arr[method](() => {
              /* no op */
            });
          }

          update() {
            this.arr[0] = { foo: 'bar' };
          }
        },
        false,
        `[[${method} no-op assign via custom equals]]`
      );

      this.assertReactivity(
        class extends Component {
          arr = trackedArray(['foo', 'bar']);

          get value() {
            // @ts-expect-error -- this can't be represented easily in TS, and we
            // don't actually care that it is; we're *just* testing reactivity.
            return this.arr[method](() => {
              /* no op */
            });
          }

          update() {
            this.arr.sort();
          }
        },
        true,
        `[[${method} collection tag]]`
      );
    });
  }

  @test
  'Mutating collection set methods + default equals'() {
    ['fill', 'pop', 'push', 'sort', 'unshift', 'splice'].forEach((method) => {
      this.assertReactivity(
        class extends Component {
          arr = trackedArray(['foo', 'bar']);

          get value() {
            return void this.arr.forEach(() => {
              /* no op */
            });
          }

          update() {
            // @ts-expect-error -- this can't be represented easily in TS, and we
            // don't actually care that it is; we're *just* testing reactivity.
            this.arr[method](undefined);
          }
        },
        true,
        `[[${method} collection tag]]`
      );
    });
  }

  @test
  'copyWithin with no arguments does not cause a change'() {
    this.assertReactivity(
      class extends Component {
        arr = trackedArray(['foo', 'bar']);

        get value() {
          return void this.arr.forEach(() => {
            /* no op */
          });
        }

        update() {
          // @ts-expect-error -- this can't be represented easily in TS, and we
          // don't actually care that it is; we're *just* testing reactivity.
          this.arr.copyWithin(undefined);
        }
      },
      false,
      `[[copyWithin with no args collection tag]]`
    );
  }

  @test
  ARRAY_SETTER_METHODS() {
    ARRAY_SETTER_METHODS.forEach((method) => {
      this.assertReactivity(
        class extends Component {
          arr = trackedArray(['foo', 'bar'], { equals: () => false });

          get value() {
            return this.arr[0];
          }

          update() {
            // @ts-expect-error -- this can't be represented easily in TS, and we
            // don't actually care that it is; we're *just* testing reactivity.
            this.arr[method](undefined);
          }
        },
        true,
        `[[${method} individual index via reference equality (no Object.is) -- tracked-built-ins behavior]]`
      );

      this.assertReactivity(
        class extends Component {
          arr = trackedArray(['foo', 'bar'], { equals: () => false });

          get value() {
            return void this.arr.forEach(() => {
              /* no op */
            });
          }

          update() {
            // @ts-expect-error -- this can't be represented easily in TS, and we
            // don't actually care that it is; we're *just* testing reactivity.
            this.arr[method](undefined);
          }
        },
        true,
        `[[${method} collection tag via reference equality (no Object.is) -- tracked-built-ins behavior]]`
      );
    });
  }
}

jitSuite(TrackedArrayTest);
