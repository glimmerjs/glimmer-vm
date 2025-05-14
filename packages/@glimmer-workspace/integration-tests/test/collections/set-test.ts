import { trackedSet } from '@glimmer/validator';
import {
  defineComponent,
  GlimmerishComponent as Component,
  jitSuite,
  RenderTest,
  test,
} from '@glimmer-workspace/integration-tests';

class TrackedSetTest extends RenderTest {
  static suiteName = `trackedSet() (rendering)`;

  @test
  'options.equals: default equals does not dirty on no-op changes'(assert: Assert) {
    let key = { foo: '123' };
    const obj = trackedSet([key]);
    const step = () => {
      let str = [...obj.values()].map((x) => x.foo).join();
      assert.step(str);
      return str;
    };

    const Foo = defineComponent({ step }, '{{(step)}}');

    this.renderComponent(Foo);

    this.assertHTML('123');
    assert.verifySteps(['123']);

    obj.add(key);
    this.rerender();

    this.assertHTML('123');
    this.assertStableRerender();
    assert.verifySteps([]);
  }

  @test
  'options.equals: using equals can dirty on every change'(assert: Assert) {
    let key = { foo: '123' };
    const obj = trackedSet([key], { equals: () => false });
    const step = () => {
      let str = [...obj.values()].map((x) => x.foo).join();
      assert.step(str);
      return str;
    };

    const Foo = defineComponent({ step }, '{{(step)}}');

    this.renderComponent(Foo);

    this.assertHTML('123');
    assert.verifySteps(['123']);

    obj.add(key);
    this.rerender();

    this.assertHTML('123');
    this.assertStableRerender();
    assert.verifySteps([]);
  }

  @test
  'add/has'() {
    this.assertReactivity(
      class extends Component {
        set = trackedSet();

        get value() {
          return this.set.has('foo');
        }

        update() {
          this.set.add('foo');
        }
      }
    );
  }

  @test
  'add/has existing value'() {
    this.assertReactivity(
      class extends Component {
        set = trackedSet(['foo']);

        get value() {
          return this.set.has('foo');
        }

        update() {
          this.set.add('foo');
        }
      },
      false
    );
  }

  @test
  'add/has existing value (with always-dirty)'() {
    this.assertReactivity(
      class extends Component {
        set = trackedSet(['foo'], { equals: () => false });

        get value() {
          return this.set.has('foo');
        }

        update() {
          this.set.add('foo');
        }
      }
    );
  }

  @test
  'add/has unrelated value'() {
    this.assertReactivity(
      class extends Component {
        set = trackedSet();

        get value() {
          return this.set.has('foo');
        }

        update() {
          this.set.add('bar');
        }
      },
      false
    );
  }

  @test
  entries() {
    this.assertReactivity(
      class extends Component {
        set = trackedSet();

        get value() {
          return this.set.entries();
        }

        update() {
          this.set.add('foo');
        }
      }
    );
  }

  @test
  keys() {
    this.assertReactivity(
      class extends Component {
        set = trackedSet();

        get value() {
          return this.set.keys();
        }

        update() {
          this.set.add('foo');
        }
      }
    );
  }

  @test
  values() {
    this.assertReactivity(
      class extends Component {
        set = trackedSet();

        get value() {
          return this.set.values();
        }

        update() {
          this.set.add('foo');
        }
      }
    );
  }

  @test
  forEach() {
    this.assertReactivity(
      class extends Component {
        set = trackedSet();

        get value() {
          this.set.forEach(() => {
            /* no-op */
          });
          return 'test';
        }

        update() {
          this.set.add('foo');
        }
      }
    );
  }

  @test
  size() {
    this.assertReactivity(
      class extends Component {
        set = trackedSet();

        get value() {
          return this.set.size;
        }

        update() {
          this.set.add('foo');
        }
      }
    );
  }

  @test
  delete() {
    this.assertReactivity(
      class extends Component {
        set = trackedSet(['foo', 123]);

        get value() {
          return this.set.has('foo');
        }

        update() {
          this.set.delete('foo');
        }
      }
    );
  }

  @test
  'delete unrelated value'() {
    this.assertReactivity(
      class extends Component {
        set = trackedSet(['foo', 123]);

        get value() {
          return this.set.has('foo');
        }

        update() {
          this.set.delete(123);
        }
      },
      false
    );
  }

  @test
  clear() {
    this.assertReactivity(
      class extends Component {
        set = trackedSet(['foo', 123]);

        get value() {
          return this.set.has('foo');
        }

        update() {
          this.set.clear();
        }
      }
    );
  }

  @test
  'each: add'() {
    this.assertEachReactivity(
      class extends Component {
        collection = trackedSet(['foo', 123]);

        update() {
          this.collection.add('bar');
        }
      }
    );
  }

  @test
  'each: add existing value'() {
    this.assertEachReactivity(
      class extends Component {
        collection = trackedSet(['foo', 123]);

        update() {
          this.collection.add('foo');
        }
      }
    );
  }
}

jitSuite(TrackedSetTest);

// TODO: These tests are currently unstable on release, turn back on once
// behavior is fixed
// eachInReactivityTest(
//   'add',
//   class extends Component {
//     collection = trackedSet(['foo', 123]);
//     update() {
//       this.collection.add('bar');
//     }
//   }
// );
// eachInReactivityTest(
//   'add existing value',
//   class extends Component {
//     collection = trackedSet(['foo', 123]);
//     update() {
//       this.collection.add('foo');
//     }
//   }
// );
