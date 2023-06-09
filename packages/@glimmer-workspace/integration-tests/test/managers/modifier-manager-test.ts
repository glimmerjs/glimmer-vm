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
    let foo = this.defineModifier(EmptyModifier());

    let Main = defineComponent({ foo }, '<h1 {{foo}}>hello world</h1>');

    this.renderComponent(Main);

    this.assertHTML(`<h1>hello world</h1>`);
  }

  @test 'custom lifecycle hooks'(assert: Assert) {
    let foo = this.defineModifier(ModifierWithHooks);

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
    let { Child } = ModifiersWithInheritance(
      <T extends object>(klass: T): T => this.defineModifier(klass)
    );

    let Main = defineComponent({ bar: Child }, '<h1 {{bar @truthy}}>hello world</h1>');

    this.renderComponent(Main, { truthy: true });
    this.assertHTML(`<h1>hello world</h1>`);
    assert.verifyActions(['Foo didInsertElement', 'Bar didInsertElement']);
  }

  @test 'can give consistent access to underlying DOM element'(assert: Assert) {
    let foo = this.defineModifier(ModifierAccessingElement);

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
    let trackedOne = new TrackedClass();
    let trackedTwo = new TrackedClass();

    let foo = this.defineModifier(ModifierWithAutotrackedHooks(trackedOne, trackedTwo));

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
    let foo = this.defineModifier(DetailedModifier);

    let Main = defineComponent({ foo }, '<h1 {{foo}}>hello world</h1>');

    assert.throws(() => {
      this.renderComponent(Main);
    }, /You attempted to update `foo` on `.*`, but it had already been used previously in the same computation/u);
  }

  @test
  'does not eagerly access arguments during destruction'(assert: Assert) {
    let foo = this.defineModifier(EmptyModifier());

    let Main = defineComponent(
      { foo },
      '{{#if @state.show}}<h1 {{foo @state.bar baz=@state.baz}}>hello world</h1>{{/if}}'
    );

    let state = new State();

    this.renderComponent(Main, { state });

    state.show = false;

    this.rerender();

    assert.verifyActions([]);
  }
}

class State {
  @tracked accessor show = true;

  get bar() {
    if (this.show === false) {
      QUnit.assert.action('[hook] bar');
    }

    return;
  }

  get baz() {
    if (this.show === false) {
      QUnit.assert.action('[hook] baz');
    }

    return;
  }
}

class TrackedClass {
  @tracked accessor count = 0;
}

function EmptyModifier() {
  return class EmptyModifier extends CustomModifier {};
}

class ModifierAccessingElement extends CustomModifier {
  savedElement?: Element;

  override didInsertElement() {
    // consume first positional argument (ensures updates run)
    this.args.positional[0];

    QUnit.assert.action('hook: didInsertElement');
    QUnit.assert.strictEqual(this.element.tagName, 'H1');
    this.savedElement = this.element;
  }

  override didUpdate() {
    QUnit.assert.action('hook: didUpdate');
    QUnit.assert.strictEqual(this.element, this.savedElement);
  }

  override willDestroyModifier() {
    QUnit.assert.action('hook: willDestroy');
    QUnit.assert.strictEqual(this.element, this.savedElement);
  }
}

class DetailedModifier extends CustomModifier {
  @tracked accessor foo = 123;

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

class ModifierWithHooks extends CustomModifier {
  override didInsertElement() {
    QUnit.assert.action('Called didInsertElement');
    QUnit.assert.strictEqual(this.args.positional[0], true, 'gets initial args');
  }
  override didUpdate() {
    QUnit.assert.action('Called didUpdate');
    QUnit.assert.strictEqual(this.args.positional[0], 'true', 'gets updated args');
  }
  override willDestroyModifier() {
    QUnit.assert.action('Called willDestroyModifier');
  }
}

function ModifierWithAutotrackedHooks(
  trackedOne: { count: number },
  trackedTwo: { count: number }
) {
  return class ModifierWithAutotrackedHooks extends CustomModifier {
    override didInsertElement() {
      // track the count of the first item

      trackedOne.count;
      QUnit.assert.action('hook: didInstall');
    }

    override willDestroyModifier() {
      QUnit.assert.action('hook: willDestroy');
    }

    override didUpdate() {
      // track the count of the second item
      trackedTwo.count;
      QUnit.assert.action('hook: didUpdate');
    }
  };
}

function ModifiersWithInheritance(define: <T extends object>(object: T) => T) {
  let Parent = define(
    class ModifierWithOneHook extends CustomModifier {
      override didInsertElement() {
        QUnit.assert.action('Foo didInsertElement');
        QUnit.assert.strictEqual(this.args.positional[0], true, 'gets initial args');
      }
    }
  );

  class Child extends Parent {
    override didInsertElement() {
      super.didInsertElement();
      QUnit.assert.action('Bar didInsertElement');
      QUnit.assert.strictEqual(this.args.positional[0], true, 'gets initial args');
    }
  }

  return { Parent, Child };
}

class CustomModifierManager implements ModifierManager<CustomModifier> {
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
}

class ModifierUsingPositionalArguments extends CustomModifier {
  override didInsertElement() {
    // consume the second positional
    this.args.positional[1];
    QUnit.assert.action('hook: didInsertElement');
  }

  override didUpdate() {
    // consume the second positional
    this.args.positional[1];
    QUnit.assert.action('hook: didUpdate');
  }
}

class ModifierManagerTest322 extends ModifierManagerTest {
  static suiteName = 'Basic Custom Modifier Manager: 3.22';

  CustomModifierManager = CustomModifierManager;

  @test 'modifiers only track positional arguments they consume'(assert: Assert) {
    let foo = this.defineModifier(ModifierUsingPositionalArguments);

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
