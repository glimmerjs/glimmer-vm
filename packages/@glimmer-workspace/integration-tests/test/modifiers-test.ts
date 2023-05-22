import type { Dict, Nullable, SimpleElement } from '@glimmer/interfaces';

import { type Count, jitSuite, RenderTest, test } from '..';

class BaseModifier {
  element?: SimpleElement;
  didInsertElement(_parameters: unknown[], _hash: Dict<unknown>): void {}
  willDestroyElement(): void {}
  didUpdate(_parameters: unknown[], _hash: Dict<unknown>): void {}
}

abstract class AbstractInsertable extends BaseModifier {
  abstract override didInsertElement(_parameters: unknown[], _hash: Dict<unknown>): void;
}

abstract class AbstractDestroyable extends BaseModifier {
  abstract override willDestroyElement(): void;
}

class ModifierTests extends RenderTest {
  static suiteName = 'modifiers';

  @test.todo
  'Element modifier with hooks'(assert: Assert, count: Count) {
    this.registerModifier(
      'foo',
      class {
        element?: SimpleElement;
        didInsertElement() {
          count.expect('didInsertElement');
          assert.ok(this.element, 'didInsertElement');
          assert.strictEqual(this.element?.getAttribute('data-ok'), 'true', 'didInsertElement');
        }

        didUpdate() {
          count.expect('didUpdate');
          assert.ok(true, 'didUpdate');
        }

        willDestroyElement() {
          count.expect('willDestroyElement');
          assert.ok(true, 'willDestroyElement');
        }
      }
    );

    this.render('{{#if this.ok}}<div data-ok=true {{foo this.bar}}></div>{{/if}}', {
      bar: 'bar',
      ok: true,
    });

    this.rerender({ bar: 'foo' });
    this.rerender({ ok: false });
  }

  @test.todo
  'didUpdate is not called when params are constants'(assert: Assert, count: Count) {
    this.registerModifier(
      'foo',
      class {
        element?: SimpleElement;
        didInsertElement() {
          count.expect('didInsertElement');
          assert.ok(true);
        }
        didUpdate() {
          count.expect('didUpdate', 0);
          assert.ok(false);
        }
        willDestroyElement() {
          count.expect('willDestroyElement');
        }
      }
    );

    this.render('{{#if this.ok}}<div {{foo "foo" bar="baz"}}></div>{{/if}}{{this.ok}}', {
      ok: true,
      data: 'ok',
    });
    this.rerender({ data: 'yup' });
    this.rerender({ ok: false });
  }

  @test.todo
  'modifiers on components are forwarded to a single element receiving the splattributes'(
    assert: Assert
  ) {
    let modifierParameters: Nullable<unknown[]> = null;
    let modifierNamedArgs: Nullable<Dict<unknown>> = null;
    let modifiedElement: SimpleElement | undefined;
    class Bar extends AbstractInsertable {
      didInsertElement(parameters: unknown[], namedArgs: Dict<unknown>) {
        modifierParameters = parameters;
        modifierNamedArgs = namedArgs;
        modifiedElement = this.element;
      }
    }
    this.registerComponent('Glimmer', 'TheFoo', '<div id="inner-div" ...attributes>Foo</div>');
    this.registerModifier('bar', Bar);
    this.render('<TheFoo {{bar "something" foo="else"}}/>');
    assert.deepEqual(modifierParameters, ['something']);
    assert.deepEqual(modifierNamedArgs, { foo: 'else' });
    assert.strictEqual(
      modifiedElement && modifiedElement.getAttribute('id'),
      'inner-div',
      'Modifier is called on the element receiving the splattributes'
    );
  }

  @test.todo
  'modifiers on components are forwarded to all the elements receiving the splattributes'(
    assert: Assert
  ) {
    let elementIds: Nullable<string>[] = [];
    class Bar extends AbstractInsertable {
      didInsertElement(parameters: unknown[], namedArgs: Dict<unknown>) {
        assert.deepEqual(parameters, ['something']);
        assert.deepEqual(namedArgs, { foo: 'else' });
        if (this.element) {
          elementIds.push(this.element.getAttribute('id'));
        }
      }
    }
    this.registerComponent(
      'Glimmer',
      'TheFoo',
      '<div id="inner-one" ...attributes>Foo</div><div id="inner-two" ...attributes>Bar</div>'
    );
    this.registerModifier('bar', Bar);
    this.render('<TheFoo {{bar "something" foo="else"}}/>');
    assert.deepEqual(
      elementIds,
      ['inner-one', 'inner-two'],
      'The modifier has been instantiated twice, once for each element with splattributes'
    );
  }

  @test.todo
  'modifiers on components accept bound arguments and track changes on them'(assert: Assert) {
    let modifierParameters: Nullable<unknown[]> = null;
    let modifierNamedArgs: Nullable<Dict<unknown>> = null;
    let modifiedElement: SimpleElement | undefined;
    class Bar extends AbstractInsertable {
      didInsertElement(parameters: unknown[], namedArgs: Dict<unknown>) {
        modifierParameters = parameters;
        modifierNamedArgs = namedArgs;
        modifiedElement = this.element;
      }
      override didUpdate(parameters: unknown[], namedArgs: Dict<unknown>) {
        modifierParameters = parameters;
        modifierNamedArgs = namedArgs;
        modifiedElement = this.element;
      }
    }
    this.registerComponent('Glimmer', 'TheFoo', '<div id="inner-div" ...attributes>Foo</div>');
    this.registerModifier('bar', Bar);
    this.render('<TheFoo {{bar this.something foo=this.foo}}/>', {
      something: 'something',
      foo: 'else',
    });
    assert.deepEqual(modifierParameters, ['something']);
    assert.deepEqual(modifierNamedArgs, { foo: 'else' });
    assert.strictEqual(
      modifiedElement && modifiedElement.getAttribute('id'),
      'inner-div',
      'Modifier is called on the element receiving the splattributes'
    );
    this.rerender({ something: 'another', foo: 'thingy' });
    assert.deepEqual(modifierParameters, ['another']);
    assert.deepEqual(modifierNamedArgs, { foo: 'thingy' });
    assert.strictEqual(
      modifiedElement && modifiedElement.getAttribute('id'),
      'inner-div',
      'Modifier is called on the element receiving the splattributes'
    );
  }

  @test.todo
  'modifiers on components accept `this` in both positional params and named arguments, and updates when it changes'(
    assert: Assert
  ) {
    let modifierParameters: Nullable<unknown[]> = null;
    let modifierNamedArgs: Nullable<Dict<unknown>> = null;
    let modifiedElement: SimpleElement | undefined;
    class Bar extends AbstractInsertable {
      didInsertElement(parameters: unknown[], namedArgs: Dict<unknown>) {
        modifierParameters = parameters;
        modifierNamedArgs = namedArgs;
        modifiedElement = this.element;
      }
      override didUpdate(parameters: unknown[], namedArgs: Dict<unknown>) {
        modifierParameters = parameters;
        modifierNamedArgs = namedArgs;
        modifiedElement = this.element;
      }
    }
    let context = { id: 1 };
    let context2 = { id: 2 };
    this.registerComponent('Glimmer', 'TheFoo', '<div id="inner-div" ...attributes>Foo</div>');
    this.registerModifier('bar', Bar);
    this.render('<TheFoo {{bar "name" this foo=this}}/>', context);
    assert.deepEqual(modifierParameters, ['name', context]);
    assert.deepEqual(modifierNamedArgs, { foo: context });
    assert.strictEqual(
      modifiedElement && modifiedElement.getAttribute('id'),
      'inner-div',
      'Modifier is called on the element receiving the splattributes'
    );
    this.rerender(context2);
    assert.deepEqual(modifierParameters, ['name', context2]);
    assert.deepEqual(modifierNamedArgs, { foo: context2 });
    assert.strictEqual(
      modifiedElement && modifiedElement.getAttribute('id'),
      'inner-div',
      'Modifier is called on the element receiving the splattributes'
    );
  }

  @test.todo
  'modifiers on components accept local variables in both positional params and named arguments, and updates when they change'(
    assert: Assert
  ) {
    let modifierParameters: Nullable<unknown[]> = null;
    let modifierNamedArgs: Nullable<Dict<unknown>> = null;
    let modifiedElement: SimpleElement | undefined;
    class Bar extends AbstractInsertable {
      didInsertElement(parameters: unknown[], namedArgs: Dict<unknown>) {
        modifierParameters = parameters;
        modifierNamedArgs = namedArgs;
        modifiedElement = this.element;
      }
      override didUpdate(parameters: unknown[], namedArgs: Dict<unknown>) {
        modifierParameters = parameters;
        modifierNamedArgs = namedArgs;
        modifiedElement = this.element;
      }
    }
    this.registerComponent('Glimmer', 'TheFoo', '<div id="inner-div" ...attributes>Foo</div>');
    this.registerModifier('bar', Bar);
    this.render(
      `
      {{#let this.foo as |v|}}
        <TheFoo {{bar v foo=v}}/>
      {{/let}}
    `,
      { foo: 'bar' }
    );
    assert.deepEqual(modifierParameters, ['bar']);
    assert.deepEqual(modifierNamedArgs, { foo: 'bar' });
    assert.strictEqual(
      modifiedElement && modifiedElement.getAttribute('id'),
      'inner-div',
      'Modifier is called on the element receiving the splattributes'
    );
    this.rerender({ foo: 'qux' });
    assert.deepEqual(modifierParameters, ['qux']);
    assert.deepEqual(modifierNamedArgs, { foo: 'qux' });
    assert.strictEqual(
      modifiedElement && modifiedElement.getAttribute('id'),
      'inner-div',
      'Modifier is called on the element receiving the splattributes'
    );
  }

  @test.todo
  'modifiers on components can be received and forwarded to inner components'(assert: Assert) {
    let modifierParameters: Nullable<unknown[]> = null;
    let modifierNamedArgs: Nullable<Dict<unknown>> = null;
    let elementIds: Nullable<string>[] = [];

    class Bar extends AbstractInsertable {
      didInsertElement(parameters: unknown[], namedArgs: Dict<unknown>) {
        modifierParameters = parameters;
        modifierNamedArgs = namedArgs;
        if (this.element) {
          elementIds.push(this.element.getAttribute('id'));
        }
      }
    }
    this.registerComponent(
      'Glimmer',
      'TheInner',
      '<div id="inner-div" ...attributes>{{yield}}</div>'
    );
    this.registerComponent(
      'Glimmer',
      'TheFoo',
      '<div id="outer-div" ...attributes>Outer</div><TheInner ...attributes>Hello</TheInner>'
    );
    this.registerModifier('bar', Bar);
    this.render(
      `
      {{#let this.foo as |v|}}
        <TheFoo {{bar v foo=v}}/>
      {{/let}}
    `,
      { foo: 'bar' }
    );
    assert.deepEqual(modifierParameters, ['bar']);
    assert.deepEqual(modifierNamedArgs, { foo: 'bar' });
    assert.deepEqual(elementIds, ['outer-div', 'inner-div'], 'Modifiers are called on all levels');
  }

  @test.todo
  'same element insertion order'(assert: Assert) {
    let insertionOrder: string[] = [];

    class Foo extends AbstractInsertable {
      didInsertElement() {
        insertionOrder.push('foo');
      }
    }

    class Bar extends AbstractInsertable {
      didInsertElement() {
        insertionOrder.push('bar');
      }
    }
    this.registerModifier('bar', Bar);
    this.registerModifier('foo', Foo);

    this.render('<div {{foo}} {{bar}}></div>');
    assert.deepEqual(insertionOrder, ['foo', 'bar']);
  }

  @test.todo
  'same element destruction order'(assert: Assert) {
    let destructionOrder: string[] = [];

    class Foo extends AbstractDestroyable {
      willDestroyElement() {
        destructionOrder.push('foo');
      }
    }

    class Bar extends AbstractDestroyable {
      willDestroyElement() {
        destructionOrder.push('bar');
      }
    }
    this.registerModifier('bar', Bar);
    this.registerModifier('foo', Foo);

    this.render('{{#if this.nuke}}<div {{foo}} {{bar}}></div>{{/if}}', { nuke: true });
    assert.deepEqual(destructionOrder, []);
    this.rerender({ nuke: false });
    assert.deepEqual(destructionOrder, ['foo', 'bar']);
  }

  @test.todo
  'parent -> child insertion order'(assert: Assert) {
    let insertionOrder: string[] = [];

    class Foo extends AbstractInsertable {
      didInsertElement() {
        insertionOrder.push('foo');
      }
    }

    class Bar extends AbstractInsertable {
      didInsertElement() {
        insertionOrder.push('bar');
      }
    }
    this.registerModifier('bar', Bar);
    this.registerModifier('foo', Foo);

    this.render('<div {{foo}}><div {{bar}}></div></div>');
    assert.deepEqual(insertionOrder, ['bar', 'foo']);
  }

  @test.todo
  'parent -> child destruction order'(assert: Assert) {
    let destructionOrder: string[] = [];

    class Foo extends AbstractDestroyable {
      willDestroyElement() {
        destructionOrder.push('foo');
      }
    }

    class Bar extends AbstractDestroyable {
      willDestroyElement() {
        destructionOrder.push('bar');
      }
    }
    this.registerModifier('bar', Bar);
    this.registerModifier('foo', Foo);

    this.render('{{#if this.nuke}}<div {{foo}}><div {{bar}}></div></div>{{/if}}', { nuke: true });
    assert.deepEqual(destructionOrder, []);
    this.rerender({ nuke: false });
    assert.deepEqual(destructionOrder, ['bar', 'foo']);
  }

  @test.todo
  'sibling insertion order'(assert: Assert) {
    let insertionOrder: string[] = [];

    class Foo extends AbstractInsertable {
      didInsertElement() {
        insertionOrder.push('foo');
      }
    }

    class Bar extends AbstractInsertable {
      didInsertElement() {
        insertionOrder.push('bar');
      }
    }

    class Baz extends AbstractInsertable {
      didInsertElement() {
        insertionOrder.push('baz');
      }
    }
    this.registerModifier('bar', Bar);
    this.registerModifier('foo', Foo);
    this.registerModifier('baz', Baz);

    this.render('<div {{foo}}><div {{bar}}></div><div {{baz}}></div></div>');
    assert.deepEqual(insertionOrder, ['bar', 'baz', 'foo']);
  }

  @test.todo
  'sibling destruction order'(assert: Assert) {
    let destructionOrder: string[] = [];

    class Foo extends AbstractDestroyable {
      willDestroyElement() {
        destructionOrder.push('foo');
      }
    }

    class Bar extends AbstractDestroyable {
      willDestroyElement() {
        destructionOrder.push('bar');
      }
    }

    class Baz extends AbstractDestroyable {
      willDestroyElement() {
        destructionOrder.push('baz');
      }
    }
    this.registerModifier('bar', Bar);
    this.registerModifier('foo', Foo);
    this.registerModifier('baz', Baz);

    this.render(
      '{{#if this.nuke}}<div {{foo}}><div {{bar}}></div><div {{baz}}></div></div>{{/if}}',
      {
        nuke: true,
      }
    );
    assert.deepEqual(destructionOrder, []);
    this.rerender({ nuke: false });
    assert.deepEqual(destructionOrder, ['bar', 'baz', 'foo']);
  }

  @test.todo
  'with params'(assert: Assert, count: Count) {
    class Foo extends BaseModifier {
      override didInsertElement([bar]: string[]) {
        count.expect('didInsertElement');
        assert.strictEqual(bar, 'bar');
      }
      override didUpdate([foo]: string[]) {
        count.expect('didUpdate');
        assert.strictEqual(foo, 'foo');
      }
    }
    this.registerModifier('foo', Foo);
    this.render('<div {{foo this.bar}}></div>', { bar: 'bar' });
    this.rerender({ bar: 'foo' });
  }

  @test.todo
  'with hash'(assert: Assert, count: Count) {
    class Foo extends BaseModifier {
      override didInsertElement(_parameters: unknown[], { bar }: Dict<string>) {
        count.expect('didInsertElement');
        assert.strictEqual(bar, 'bar');
      }
      override didUpdate(_parameters: unknown[], { bar }: Dict<string>) {
        count.expect('didUpdate');
        assert.strictEqual(bar, 'foo');
      }
    }
    this.registerModifier('foo', Foo);
    this.render('<div {{foo bar=this.bar}}></div>', { bar: 'bar' });
    this.rerender({ bar: 'foo' });
  }

  @test.todo
  'with hash and params'(assert: Assert, count: Count) {
    class Foo extends BaseModifier {
      override didInsertElement([baz]: string[], { bar }: Dict<string>) {
        count.expect('didInsertElement');
        assert.strictEqual(bar, 'bar');
        assert.strictEqual(baz, 'baz');
      }
      override didUpdate([foo]: string[], { bar }: Dict<string>) {
        count.expect('didUpdate');
        assert.strictEqual(bar, 'foo');
        assert.strictEqual(foo, 'foo');
      }
    }
    this.registerModifier('foo', Foo);
    this.render('<div {{foo this.baz bar=this.bar}}></div>', { bar: 'bar', baz: 'baz' });
    this.rerender({ bar: 'foo', baz: 'foo' });
  }
}
jitSuite(ModifierTests);
