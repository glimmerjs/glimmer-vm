import type { Arguments, ModifierManager, Owner } from '@glimmer/interfaces';
import { modifierCapabilities, setModifierManager } from '@glimmer/manager';

import { defineComponent, jitSuite, RenderTest, test, tracked, trackedObj } from '../..';
import type { RecordedEvents } from '../../lib/test-helpers/recorded';
import { destroy, registerDestructor } from '@glimmer/destroyable';

type CreateCustomModifier = (options: {
  owner: Owner;
  args: Arguments;
  lifetime: object;
  events: RecordedEvents;
}) => CustomModifier;
/**
 * The { instance } wrapper is a lifetime -- it can be the target for destructor APIs and will
 * be destroyed when the modifier is destroyed.
 */

interface CustomModifierInstance {
  install: CustomModifier;
  lifetime: object;
  didUpdate?: DidUpdate | void;
}
type CustomModifier = (element: Element, args: Arguments) => DidInsert | void;
type DidInsert = (args: Arguments) => DidUpdate | void;
type DidUpdate = (args: Arguments) => DidUpdate | void;

abstract class ModifierManagerTest extends RenderTest {
  abstract CustomModifierManager: {
    new (owner: Owner, events: RecordedEvents): ModifierManager<CustomModifierInstance>;
  };

  defineModifier<T extends CreateCustomModifier>(modifier: T): T {
    return setModifierManager((owner) => {
      return new this.CustomModifierManager(owner, this.events);
    }, modifier);
  }

  @test 'can register a custom element modifier and render it'() {
    let foo = this.defineModifier(() => () => {});

    const Main = defineComponent({ foo }, '<h1 {{foo}}>hello world</h1>');

    this.render.component(Main);

    this.assertHTML(`<h1>hello world</h1>`);
  }

  @test 'custom lifecycle hooks'(assert: Assert) {
    let foo = this.defineModifier(({ lifetime, events }) => {
      registerDestructor(lifetime, () => events.record('willDestroy'));

      return (_, args) => {
        events.record('install');
        assert.strictEqual(args.positional[0], true, 'gets initial args');

        return (args) => {
          events.record('didInsertElement');
          assert.strictEqual(args.positional[0], true, 'gets updated args');

          return (args) => {
            events.record('didUpdate');
            assert.strictEqual(args.positional[0], 'true', 'gets updated args');
          };
        };
      };
    });

    const Main = defineComponent(
      { foo },
      '{{#if @truthy}}<h1 {{foo @truthy}}>hello world</h1>{{/if}}'
    );
    let args = trackedObj({ truthy: true });

    this.render.component(Main, args);

    this.assertHTML(`<h1>hello world</h1>`);
    this.events.all.expect([
      'manager:createModifier',
      'manager:installModifier',
      'install',
      'didInsertElement',
    ]);

    args['truthy'] = 'true';
    this.rerender();
    this.events.all.expect(['env:begin', 'manager:updateModifier', 'didUpdate', 'env:commit']);

    args['truthy'] = false;
    this.rerender();
    this.events.all.expect(['env:begin', 'manager:destroyModifier', 'willDestroy', 'env:commit']);

    args['truthy'] = true;
    this.rerender();
    this.events.all.expect([
      'env:begin',
      'manager:createModifier',
      'manager:installModifier',
      'install',
      'didInsertElement',
      'env:commit',
    ]);
  }

  @test 'associates manager even through an inheritance structure'() {
    const events = this.events;

    class Parent {
      constructor(readonly owner: Owner) {}

      didInsertElement() {
        events.record('parent:didInsertElement');
      }
    }

    setModifierManager((owner: Owner) => {
      return {
        capabilities: modifierCapabilities('3.22'),
        createModifier: (factory: typeof Parent) => {
          return new factory(owner);
        },
        installModifier: (instance: Parent) => {
          instance.didInsertElement();
        },
        destroyModifier: () => {},
        updateModifier: () => {},
      };
    }, Parent);

    class Child extends Parent {
      override didInsertElement() {
        super.didInsertElement();
        events.record('child:didInsertElement');
      }
    }

    const Main = defineComponent({ child: Child }, '<h1 {{child @truthy}}>hello world</h1>');

    this.render.component(Main, { truthy: true });
    this.assertHTML(`<h1>hello world</h1>`);
    events
      .prefixed(['parent', 'child'])
      .expect(['parent:didInsertElement', 'child:didInsertElement']);
  }

  @test 'can give consistent access to underlying DOM element'(assert: Assert) {
    const events = this.events;

    let foo = this.defineModifier(({ events, lifetime }) => {
      registerDestructor(lifetime, () => events.record('willDestroy'));

      return (element) => {
        events.record('install');

        return (args) => {
          events.record('didInsertElement');
          args.positional[0];

          assert.strictEqual(element.tagName, 'H1');

          return () => {
            events.record('didUpdate');
          };
        };
      };
    });

    const Main = defineComponent({ foo }, '<h1 {{foo @truthy}}>hello world</h1>');
    let args = trackedObj({ truthy: true });

    this.render.component(Main, args);

    events.expect(['install', 'didInsertElement']);
    this.assertHTML(`<h1>hello world</h1>`);

    args['truthy'] = 'true';
    this.rerender();
    events.expect(['didUpdate']);

    this.destroy();

    events.expect(['willDestroy']);
  }

  @test 'lifecycle hooks are autotracked by default'() {
    class TrackedClass {
      @tracked count = 0;
    }

    let trackedOne = new TrackedClass();
    let trackedTwo = new TrackedClass();

    let foo = this.defineModifier(({ events }) => {
      events.record('create');

      return () => {
        events.record('install');

        return () => {
          events.record('didInsertElement');
          trackedOne.count;

          return () => {
            events.record('didUpdate');
            trackedTwo.count;
          };
        };
      };
    });

    let Main = defineComponent({ foo }, '<h1 {{foo}}>hello world</h1>');

    this.render.component(Main);
    this.assertHTML(`<h1>hello world</h1>`);

    this.events.expect(['create', 'install', 'didInsertElement']);

    trackedTwo.count++;
    this.rerender();
    this.events.expect([]);

    trackedOne.count++;
    this.rerender();
    this.events.expect(['didUpdate']);

    trackedOne.count++;
    this.rerender();
    this.events.expect([]);

    trackedTwo.count++;
    this.rerender();
    this.events.expect(['didUpdate']);
  }

  @test
  'provides a helpful deprecation when mutating a tracked value that was consumed already within constructor'(
    assert: Assert
  ) {
    class State {
      @tracked foo = 123;
    }

    const state = new State();

    let modifier = this.defineModifier(({ events }) => {
      events.record('create');

      return () => {
        events.record('install');

        // first read the tracked property
        state.foo;

        // then attempt mutate the tracked property
        state.foo = 456;

        return (args) => {
          events.record('didInsertElement');
          args.positional[1];

          return (args) => {
            events.record('didUpdate');
            args.positional[1];
          };
        };
      };
    });

    let Main = defineComponent({ modifier }, '<h1 {{modifier}}>hello world</h1>');

    assert.throws(() => {
      this.render.component(Main);
    }, /You attempted to update `foo` on `.*`, but it had already been used previously in the same computation/u);

    this.events.expect(['create', 'install']);
  }

  @test
  'does not eagerly access arguments, including during destruction'() {
    const modifier = this.defineModifier(() => () => {});

    let Main = defineComponent(
      { modifier },
      '{{#if @state.show}}<h1 {{modifier @state.bar baz=@state.baz}}>hello world</h1>{{/if}}'
    );

    const events = this.events;

    class State {
      @tracked show = true;

      get bar() {
        if (this.show === false) {
          events.record('get bar');
        }

        return;
      }

      get baz() {
        if (this.show === false) {
          events.record('get baz');
        }

        return;
      }
    }

    let state = new State();

    this.render.component(Main, { state });

    state.show = false;

    this.rerender();

    events
      .prefixed(['manager'])
      .expect(['manager:createModifier', 'manager:installModifier', 'manager:destroyModifier']);
  }
}

class ModifierManagerTest322 extends ModifierManagerTest {
  static suiteName = 'Basic Custom Modifier Manager: 3.22';

  CustomModifierManager = class CustomModifierManager
    implements ModifierManager<CustomModifierInstance>
  {
    capabilities = modifierCapabilities('3.22');
    readonly #events: RecordedEvents;

    constructor(
      public owner: Owner,
      events: RecordedEvents
    ) {
      this.#events = events;
    }

    createModifier(Modifier: CreateCustomModifier, args: Arguments) {
      this.#events.record('manager:createModifier');

      const lifetime = {};
      const install = Modifier({ owner: this.owner, args, lifetime, events: this.#events });

      return {
        install,
        lifetime,
      };
    }

    installModifier(instance: CustomModifierInstance, element: Element, args: Arguments) {
      this.#events.record('manager:installModifier');

      const didInsert = instance.install(element, args);

      if (didInsert) {
        instance.didUpdate = didInsert(args);
      }
    }

    updateModifier(instance: CustomModifierInstance, args: Arguments) {
      this.#events.record('manager:updateModifier');

      if (instance.didUpdate) {
        const newDidUpdate = instance.didUpdate(args);

        if (newDidUpdate) {
          instance.didUpdate = newDidUpdate;
        }
      }
    }

    destroyModifier(instance: CustomModifierInstance) {
      this.#events.record('manager:destroyModifier');

      destroy(instance.lifetime);
    }
  };

  @test 'modifers only track positional arguments they consume'() {
    let foo = this.defineModifier(({ events }) => {
      events.record('create');

      return () => {
        events.record('install');

        return (args) => {
          4;

          events.record('didInsertElement');
          args.positional[1];

          return (args) => {
            events.record('didUpdate');
            args.positional[1];
          };
        };
      };
    });

    let Main = defineComponent(
      { foo },
      '<h1 {{foo @positionOne @positionTwo bar=@bar qux=@qux}}>hello world</h1>'
    );

    let args = trackedObj({
      positionOne: 'first!!!',
      positionTwo: 'second :(',
      bar: 'bar',
      qux: 'quz',
    });

    this.render.component(Main, args);

    this.assertHTML(`<h1>hello world</h1>`);

    this.events.expect(['create', 'install', 'didInsertElement']);

    args['positionOne'] = 'no first?';
    this.rerender();
    this.events.expect([]);

    args['positionTwo'] = 'YASSSSSSS!!!';
    this.rerender();
    this.events.expect(['didUpdate']);
    // assert.strictEqual(updateCount, 1);
  }

  @test 'modifers only track named arguments they consume'() {
    let foo = this.defineModifier(({ events }) => {
      events.record('create');

      return () => {
        events.record('install');

        return (args) => {
          events.record('didInsertElement');
          args.named['qux'];

          return () => {
            events.record('didUpdate');
          };
        };
      };
    });

    let Main = defineComponent(
      { foo },
      '<h1 {{foo @positionOne @positionTwo bar=@bar qux=@qux}}>hello world</h1>'
    );

    let args = trackedObj({
      bar: 'bar',
      qux: 'quz',
    });

    this.render.component(Main, args);

    this.assertHTML(`<h1>hello world</h1>`);

    this.events.expect(['create', 'install', 'didInsertElement']);

    args['bar'] = 'other bar';
    this.rerender();
    this.events.expect([]);

    args['qux'] = 'quuuuxxxxxx';
    this.rerender();
    this.events.expect(['didUpdate']);
  }
}

jitSuite(ModifierManagerTest322);
