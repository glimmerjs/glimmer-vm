import { trackedWeakSet } from '@glimmer/validator';
import {
  GlimmerishComponent as Component,
  jitSuite,
  RenderTest,
  test,
} from '@glimmer-workspace/integration-tests';

class TrackedWeakSetTest extends RenderTest {
  static suiteName = `trackedWeakSet() (rendering)`;

  @test
  'add/has'() {
    this.assertReactivity(
      class extends Component {
        obj = {};
        set = trackedWeakSet();

        get value() {
          return this.set.has(this.obj);
        }

        update() {
          this.set.add(this.obj);
        }
      }
    );
  }

  @test
  'add/has existing value'() {
    this.assertReactivity(
      class extends Component {
        obj = {};
        obj2 = {};
        set = trackedWeakSet([this.obj]);

        get value() {
          return this.set.has(this.obj);
        }

        update() {
          this.set.add(this.obj);
        }
      },
      false
    );
  }

  @test
  'add/has existing value (always invalidates)'() {
    this.assertReactivity(
      class extends Component {
        obj = {};
        obj2 = {};
        set = trackedWeakSet([this.obj], { equals: () => false });

        get value() {
          return this.set.has(this.obj);
        }

        update() {
          this.set.add(this.obj);
        }
      }
    );
  }

  @test
  'add/has unrelated value'() {
    this.assertReactivity(
      class extends Component {
        obj = {};
        obj2 = {};
        set = trackedWeakSet();

        get value() {
          return this.set.has(this.obj);
        }

        update() {
          this.set.add(this.obj2);
        }
      },
      false
    );
  }

  @test
  delete() {
    this.assertReactivity(
      class extends Component {
        obj = {};
        obj2 = {};
        set = trackedWeakSet([this.obj, this.obj2]);

        get value() {
          return this.set.has(this.obj);
        }

        update() {
          this.set.delete(this.obj);
        }
      }
    );
  }

  @test
  'delete unrelated value'() {
    this.assertReactivity(
      class extends Component {
        obj = {};
        obj2 = {};
        set = trackedWeakSet([this.obj, this.obj2]);

        get value() {
          return this.set.has(this.obj);
        }

        update() {
          this.set.delete(this.obj2);
        }
      },
      false
    );
  }
}

jitSuite(TrackedWeakSetTest);
