import type { Arguments, ModifierManager, Owner } from '@glimmer/interfaces';
import { modifierCapabilities, setModifierManager } from '@glimmer/manager';
import { getOwner, setOwner } from '@glimmer/owner';

import { defineComponent, jitSuite, RenderTest, test, tracked, trackedObj } from '../..';
import { trackedCell } from '@glimmer/validator';

abstract class CustomModifier {
  static create<This extends { new (owner: object, args: Arguments): unknown }>(
    this: This,
    args: Arguments
  ): InstanceType<This> {
    return new this(getOwner(args)!, args) as InstanceType<This>;
  }

  constructor(owner: Owner, public args: Arguments) {
    setOwner(this, owner);
  }

  declare element: Element;

  didInsertElement(): void {}
  didUpdate(): void {}
  willDestroyModifier(): void {}
}

abstract class ModifierManagerTest extends RenderTest {
  abstract CustomModifierManager: { new (owner: Owner): ModifierManager<CustomModifier> };

  defineModifier<T extends object>(Klass: T): T {
    return setModifierManager((owner) => {
      return new this.CustomModifierManager(owner);
    }, Klass);
  }

  @test 'can register a custom element modifier and render it'() {
    let foo = this.defineModifier(
      class extends CustomModifier {
        override didInsertElement() {}
        override didUpdate() {}
        override willDestroyModifier() {}
      }
    );

    let Main = defineComponent({ foo }, '<h1 {{foo}}>hello world</h1>');

    this.renderComponent(Main);

    this.assertHTML(`<h1>hello world</h1>`);
  }

  @test 'custom lifecycle hooks'(assert: Assert) {
    let foo = this.defineModifier(
      class extends CustomModifier {
        override didInsertElement() {
          assert.action('Called didInsertElement');
          assert.strictEqual(this.args.positional[0], true, 'gets initial args');
        }
        override didUpdate() {
          assert.action('Called didUpdate');
          assert.strictEqual(this.args.positional[0], 'true', 'gets updated args');
        }
        override willDestroyModifier() {
          assert.action('Called willDestroyModifier');
        }
      }
    );

    let Main = defineComponent(
      { foo },
      '{{#if @truthy}}<h1 {{foo @truthy}}>hello world</h1>{{/if}}'
    );
    let args = trackedObj({ truthy: true });

    this.renderComponent(Main, args);

    this.assertHTML(`<h1>hello world</h1>`);
    assert.verifyActions(['Called didInsertElement']);

    args['truthy'] = 'true';
    this.rerender();
    assert.verifyActions(['Called didUpdate']);

    args['truthy'] = false;
    this.rerender();
    assert.verifyActions(['Called willDestroyModifier']);

    args['truthy'] = true;
    this.rerender();
    assert.verifyActions(['Called didInsertElement']);
  }

  @test 'associates manager even through an inheritance structure'(assert: Assert) {
    let Foo = this.defineModifier(
      class extends CustomModifier {
        override didInsertElement() {
          assert.action('Foo didInsertElement');
          assert.strictEqual(this.args.positional[0], true, 'gets initial args');
        }
      }
    );

    class Bar extends Foo {
      override didInsertElement() {
        super.didInsertElement();
        assert.action('Bar didInsertElement');
        assert.strictEqual(this.args.positional[0], true, 'gets initial args');
      }
    }

    let Main = defineComponent({ bar: Bar }, '<h1 {{bar @truthy}}>hello world</h1>');

    this.renderComponent(Main, { truthy: true });
    this.assertHTML(`<h1>hello world</h1>`);
    assert.verifyActions(['Foo didInsertElement', 'Bar didInsertElement']);
  }

  @test 'can give consistent access to underlying DOM element'(assert: Assert) {
    let foo = this.defineModifier(
      class extends CustomModifier {
        savedElement?: Element;

        override didInsertElement() {
          // consume first positional argument (ensures updates run)
          this.args.positional[0];

          assert.action('hook: didInsertElement');
          assert.strictEqual(this.element.tagName, 'H1');
          this.savedElement = this.element;
        }

        override didUpdate() {
          assert.action('hook: didUpdate');
          assert.strictEqual(this.element, this.savedElement);
        }

        override willDestroyModifier() {
          assert.action('hook: willDestroy');
          assert.strictEqual(this.element, this.savedElement);
        }
      }
    );

    let Main = defineComponent({ foo }, '<h1 {{foo @truthy}}>hello world</h1>');
    let args = trackedObj({ truthy: true });

    this.renderComponent(Main, args);
    this.assertHTML(`<h1>hello world</h1>`);
    assert.verifyActions(['hook: didInsertElement']);

    args['truthy'] = 'true';
    this.rerender();
    assert.verifyActions(['hook: didUpdate']);
  }

  @test 'lifecycle hooks are autotracked by default'(assert: Assert) {
    class TrackedClass {
      @tracked count = 0;
    }

    let trackedOne = new TrackedClass();
    let trackedTwo = new TrackedClass();

    let foo = this.defineModifier(
      class extends CustomModifier {
        override didInsertElement() {
          // track the count of the first item

          trackedOne.count;
          assert.action('hook: didInstall');
        }

        override willDestroyModifier() {
          assert.action('hook: willDestroy');
        }

        override didUpdate() {
          // track the count of the second item
          trackedTwo.count;
          assert.action('hook: didUpdate');
        }
      }
    );

    let arg = trackedCell(0);

    let Main = defineComponent({ foo, arg }, '<h1 {{foo arg.current}}>hello world</h1>');

    this.renderComponent(Main);
    this.assertHTML(`<h1>hello world</h1>`);

    assert.verifyActions(['hook: didInstall']);

    trackedTwo.count++;
    this.rerender();
    assert.verifyActions([]);

    trackedOne.count++;
    this.rerender();
    assert.verifyActions(['hook: didUpdate']);

    trackedOne.count++;
    this.rerender();
    assert.verifyActions([]);

    trackedTwo.count++;
    this.rerender();
    assert.verifyActions(['hook: didUpdate']);
  }

  @test
  'provides a helpful deprecation when mutating a tracked value that was consumed already within constructor'(
    assert: Assert
  ) {
    class Foo extends CustomModifier {
      @tracked foo = 123;

      constructor(owner: Owner, args: Arguments) {
        super(owner, args);

        // first read the tracked property

        this.foo;

        // then attempt to update the tracked property
        this.foo = 456;
      }

      override didInsertElement() {}
      override didUpdate() {}
      override willDestroyModifier() {}
    }

    let foo = this.defineModifier(Foo);

    let Main = defineComponent({ foo }, '<h1 {{foo}}>hello world</h1>');

    assert.throws(() => {
      this.renderComponent(Main);
    }, /You attempted to update `foo` on `.*`, but it had already been used previously in the same computation/u);
  }

  @test
  'does not eagerly access arguments during destruction'(assert: Assert) {
    class Foo extends CustomModifier {}

    let foo = this.defineModifier(Foo);

    let Main = defineComponent(
      { foo },
      '{{#if @state.show}}<h1 {{foo @state.bar baz=@state.baz}}>hello world</h1>{{/if}}'
    );

    let barCount = 0;
    let bazCount = 0;

    class State {
      @tracked show = true;

      get bar() {
        if (this.show === false) {
          barCount++;
        }

        return;
      }

      get baz() {
        if (this.show === false) {
          bazCount++;
        }

        return;
      }
    }

    let state = new State();

    this.renderComponent(Main, { state });

    state.show = false;

    this.rerender();

    assert.strictEqual(barCount, 0, 'bar was not accessed during detruction');
    assert.strictEqual(bazCount, 0, 'baz was not accessed during detruction');
  }
}

class ModifierManagerTest322 extends ModifierManagerTest {
  static suiteName = 'Basic Custom Modifier Manager: 3.22';

  CustomModifierManager = class CustomModifierManager implements ModifierManager<CustomModifier> {
    capabilities = modifierCapabilities('3.22');

    constructor(public owner: Owner) {}

    createModifier(
      Modifier: { new (owner: Owner, args: Arguments): CustomModifier },
      args: Arguments
    ) {
      return new Modifier(this.owner, args);
    }

    installModifier(instance: CustomModifier, element: Element, args: Arguments) {
      instance.element = element;
      instance.args = args;
      instance.didInsertElement();
    }

    updateModifier(instance: CustomModifier, args: Arguments) {
      instance.args = args;
      instance.didUpdate();
    }

    destroyModifier(instance: CustomModifier) {
      instance.willDestroyModifier();
    }
  };

  @test 'modifiers only track positional arguments they consume'(assert: Assert) {
    let foo = this.defineModifier(
      class extends CustomModifier {
        override didInsertElement() {
          // consume the second positional
          this.args.positional[1];
          assert.action('hook: didInsertElement');
        }

        override didUpdate() {
          // consume the second positional
          this.args.positional[1];
          assert.action('hook: didUpdate');
        }
      }
    );

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

    this.renderComponent(Main, args);

    this.assertHTML(`<h1>hello world</h1>`);
    assert.verifyActions(['hook: didInsertElement']);

    assert.step('[updating] unused positional');
    args['positionOne'] = 'no first?';
    this.rerender();
    assert.verifyActions([]);

    args['positionTwo'] = 'YASSSSSSS!!!';
    this.rerender();
    assert.verifyActions(['hook: didUpdate']);
  }

  @test 'modifiers only track named arguments they consume'(assert: Assert) {
    let foo = this.defineModifier(
      class extends CustomModifier {
        override didInsertElement() {
          assert.action('hook: didInsertElement');

          // consume the second positional

          // consume the second positional

          this.args.named['qux'];
        }

        override didUpdate() {
          assert.action('hook: didUpdate');
        }
      }
    );

    let Main = defineComponent(
      { foo },
      '<h1 {{foo @positionOne @positionTwo bar=@bar qux=@qux}}>hello world</h1>'
    );

    let args = trackedObj({
      bar: 'bar',
      qux: 'quz',
    });

    this.renderComponent(Main, args);

    this.assertHTML(`<h1>hello world</h1>`);
    assert.verifyActions(['hook: didInsertElement']);

    args['bar'] = 'other bar';
    this.rerender();
    assert.verifyActions([]);

    args['qux'] = 'quuuuxxxxxx';
    this.rerender();
    assert.verifyActions(['hook: didUpdate']);
  }
}

jitSuite(ModifierManagerTest322);
