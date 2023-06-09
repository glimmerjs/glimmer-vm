import type { Dict } from '@glimmer/interfaces';

import { type Count, jitSuite, RenderTest, test } from '..';

class BaseModifier {
  element?: Element;
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

  @test
  'Element modifier with hooks'(assert: Assert, count: Count) {
    this.registerModifier(
      'foo',
      class {
        element?: Element;
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

  @test
  'didUpdate is not called when params are constants'(assert: Assert) {
    this.registerModifier('constants', Insertable('constants'));

    this.render('{{#if this.ok}}<div {{constants "foo" bar="baz"}}></div>{{/if}}{{this.ok}}', {
      ok: true,
      data: 'ok',
    });

    assert.expect(['[constants] didInsertElement("foo", bar="baz")']);

    this.rerender({ data: 'yup' }, 'benign rerender');
    assert.expect([]);

    this.rerender({ ok: false }, 'remove parent element');
    assert.expect(['[constants] willDestroyElement']);
  }

  // @test
  // 'modifiers on components are forwarded to a single element receiving the splattributes'(
  //   assert: Assert
  // ) {
  //   let modifierParameters: Nullable<unknown[]> = null;
  //   let modifierNamedArgs: Nullable<Dict<unknown>> = null;
  //   let modifiedElement: Element | undefined;
  //   class Bar extends AbstractInsertable {
  //     didInsertElement(parameters: unknown[], namedArgs: Dict<unknown>) {
  //       modifierParameters = parameters;
  //       modifierNamedArgs = namedArgs;
  //       modifiedElement = this.element;
  //     }
  //   }
  //   this.registerComponent('Glimmer', 'TheFoo', '<div id="inner-div" ...attributes>Foo</div>');
  //   this.registerModifier('bar', Bar);
  //   this.render('<TheFoo {{bar "something" foo="else"}}/>');
  //   assert.deepEqual(modifierParameters, ['something']);
  //   assert.deepEqual(modifierNamedArgs, { foo: 'else' });
  //   assert.strictEqual(
  //     modifiedElement && modifiedElement.getAttribute('id'),
  //     'inner-div',
  //     'Modifier is called on the element receiving the splattributes'
  //   );
  // }

  // @test
  // 'modifiers on components are forwarded to all the elements receiving the splattributes'(
  //   assert: Assert
  // ) {
  //   let elementIds: Nullable<string>[] = [];
  //   class Bar extends AbstractInsertable {
  //     didInsertElement(parameters: unknown[], namedArgs: Dict<unknown>) {
  //       assert.deepEqual(parameters, ['something']);
  //       assert.deepEqual(namedArgs, { foo: 'else' });
  //       if (this.element) {
  //         elementIds.push(this.element.getAttribute('id'));
  //       }
  //     }
  //   }
  //   this.registerComponent(
  //     'Glimmer',
  //     'TheFoo',
  //     '<div id="inner-one" ...attributes>Foo</div><div id="inner-two" ...attributes>Bar</div>'
  //   );
  //   this.registerModifier('bar', Bar);
  //   this.render('<TheFoo {{bar "something" foo="else"}}/>');
  //   assert.deepEqual(
  //     elementIds,
  //     ['inner-one', 'inner-two'],
  //     'The modifier has been instantiated twice, once for each element with splattributes'
  //   );
  // }

  // @test
  // 'modifiers on components accept bound arguments and track changes on them'(assert: Assert) {
  //   let modifierParameters: Nullable<unknown[]> = null;
  //   let modifierNamedArgs: Nullable<Dict<unknown>> = null;
  //   let modifiedElement: Element | undefined;
  //   class Bar extends AbstractInsertable {
  //     didInsertElement(parameters: unknown[], namedArgs: Dict<unknown>) {
  //       modifierParameters = parameters;
  //       modifierNamedArgs = namedArgs;
  //       modifiedElement = this.element;
  //     }
  //     override didUpdate(parameters: unknown[], namedArgs: Dict<unknown>) {
  //       modifierParameters = parameters;
  //       modifierNamedArgs = namedArgs;
  //       modifiedElement = this.element;
  //     }
  //   }
  //   this.registerComponent('Glimmer', 'TheFoo', '<div id="inner-div" ...attributes>Foo</div>');
  //   this.registerModifier('bar', Bar);
  //   this.render('<TheFoo {{bar this.something foo=this.foo}}/>', {
  //     something: 'something',
  //     foo: 'else',
  //   });
  //   assert.deepEqual(modifierParameters, ['something']);
  //   assert.deepEqual(modifierNamedArgs, { foo: 'else' });
  //   assert.strictEqual(
  //     modifiedElement && modifiedElement.getAttribute('id'),
  //     'inner-div',
  //     'Modifier is called on the element receiving the splattributes'
  //   );
  //   this.rerender({ something: 'another', foo: 'thingy' });
  //   assert.deepEqual(modifierParameters, ['another']);
  //   assert.deepEqual(modifierNamedArgs, { foo: 'thingy' });
  //   assert.strictEqual(
  //     modifiedElement && modifiedElement.getAttribute('id'),
  //     'inner-div',
  //     'Modifier is called on the element receiving the splattributes'
  //   );
  // }

  // @test
  // 'modifiers on components accept `this` in both positional params and named arguments, and updates when it changes'(
  //   assert: Assert
  // ) {
  //   let modifierParameters: Nullable<unknown[]> = null;
  //   let modifierNamedArgs: Nullable<Dict<unknown>> = null;
  //   let modifiedElement: Element | undefined;
  //   class Bar extends AbstractInsertable {
  //     didInsertElement(parameters: unknown[], namedArgs: Dict<unknown>) {
  //       modifierParameters = parameters;
  //       modifierNamedArgs = namedArgs;
  //       modifiedElement = this.element;
  //     }
  //     override didUpdate(parameters: unknown[], namedArgs: Dict<unknown>) {
  //       modifierParameters = parameters;
  //       modifierNamedArgs = namedArgs;
  //       modifiedElement = this.element;
  //     }
  //   }
  //   let context = { id: 1 };
  //   let context2 = { id: 2 };
  //   this.registerComponent('Glimmer', 'TheFoo', '<div id="inner-div" ...attributes>Foo</div>');
  //   this.registerModifier('bar', Bar);
  //   this.render('<TheFoo {{bar "name" this foo=this}}/>', context);
  //   assert.deepEqual(modifierParameters, ['name', context]);
  //   assert.deepEqual(modifierNamedArgs, { foo: context });
  //   assert.strictEqual(
  //     modifiedElement && modifiedElement.getAttribute('id'),
  //     'inner-div',
  //     'Modifier is called on the element receiving the splattributes'
  //   );
  //   this.rerender(context2);
  //   assert.deepEqual(modifierParameters, ['name', context2]);
  //   assert.deepEqual(modifierNamedArgs, { foo: context2 });
  //   assert.strictEqual(
  //     modifiedElement && modifiedElement.getAttribute('id'),
  //     'inner-div',
  //     'Modifier is called on the element receiving the splattributes'
  //   );
  // }

  // @test
  // 'modifiers on components accept local variables in both positional params and named arguments, and updates when they change'(
  //   assert: Assert
  // ) {
  //   let modifierParameters: Nullable<unknown[]> = null;
  //   let modifierNamedArgs: Nullable<Dict<unknown>> = null;
  //   let modifiedElement: Element | undefined;
  //   class Bar extends AbstractInsertable {
  //     didInsertElement(parameters: unknown[], namedArgs: Dict<unknown>) {
  //       modifierParameters = parameters;
  //       modifierNamedArgs = namedArgs;
  //       modifiedElement = this.element;
  //     }
  //     override didUpdate(parameters: unknown[], namedArgs: Dict<unknown>) {
  //       modifierParameters = parameters;
  //       modifierNamedArgs = namedArgs;
  //       modifiedElement = this.element;
  //     }
  //   }
  //   this.registerComponent('Glimmer', 'TheFoo', '<div id="inner-div" ...attributes>Foo</div>');
  //   this.registerModifier('bar', Bar);
  //   this.render(
  //     `
  //     {{#let this.foo as |v|}}
  //       <TheFoo {{bar v foo=v}}/>
  //     {{/let}}
  //   `,
  //     { foo: 'bar' }
  //   );
  //   assert.deepEqual(modifierParameters, ['bar']);
  //   assert.deepEqual(modifierNamedArgs, { foo: 'bar' });
  //   assert.strictEqual(
  //     modifiedElement && modifiedElement.getAttribute('id'),
  //     'inner-div',
  //     'Modifier is called on the element receiving the splattributes'
  //   );
  //   this.rerender({ foo: 'qux' });
  //   assert.deepEqual(modifierParameters, ['qux']);
  //   assert.deepEqual(modifierNamedArgs, { foo: 'qux' });
  //   assert.strictEqual(
  //     modifiedElement && modifiedElement.getAttribute('id'),
  //     'inner-div',
  //     'Modifier is called on the element receiving the splattributes'
  //   );
  // }

  // @test
  // 'modifiers on components can be received and forwarded to inner components'(assert: Assert) {
  //   let modifierParameters: Nullable<unknown[]> = null;
  //   let modifierNamedArgs: Nullable<Dict<unknown>> = null;
  //   let elementIds: Nullable<string>[] = [];

  //   class Bar extends AbstractInsertable {
  //     didInsertElement(parameters: unknown[], namedArgs: Dict<unknown>) {
  //       modifierParameters = parameters;
  //       modifierNamedArgs = namedArgs;
  //       if (this.element) {
  //         elementIds.push(this.element.getAttribute('id'));
  //       }
  //     }
  //   }
  //   this.registerComponent(
  //     'Glimmer',
  //     'TheInner',
  //     '<div id="inner-div" ...attributes>{{yield}}</div>'
  //   );
  //   this.registerComponent(
  //     'Glimmer',
  //     'TheFoo',
  //     '<div id="outer-div" ...attributes>Outer</div><TheInner ...attributes>Hello</TheInner>'
  //   );
  //   this.registerModifier('bar', Bar);
  //   this.render(
  //     `
  //     {{#let this.foo as |v|}}
  //       <TheFoo {{bar v foo=v}}/>
  //     {{/let}}
  //   `,
  //     { foo: 'bar' }
  //   );
  //   assert.deepEqual(modifierParameters, ['bar']);
  //   assert.deepEqual(modifierNamedArgs, { foo: 'bar' });
  //   assert.deepEqual(elementIds, ['outer-div', 'inner-div'], 'Modifiers are called on all levels');
  // }

  @test
  'same element insertion order'(assert: Assert) {
    this.registerModifier('parent', Insertable('parent'));
    this.registerModifier('child', Insertable('child'));

    this.render('<div {{parent}} {{child}}></div>');
    assert.expect(['[parent] didInsertElement', '[child] didInsertElement']);

    this.destroy();
    assert.expect([`[parent] willDestroyElement`, `[child] willDestroyElement`]);
  }

  @test
  'same element destruction order'(assert: Assert) {
    this.registerModifier('first', Insertable('first'));
    this.registerModifier('second', Insertable('second'));

    this.render('{{#if this.nuke}}<div {{first}} {{second}}></div>{{/if}}', { nuke: true });
    assert.expect(['first: didInsertElement', 'second: didInsertElement']);
    this.rerender({ nuke: false });
    assert.expect(['first: willDestroyElement', 'second: willDestroyElement']);
  }

  @test
  'parent -> child insertion order'(assert: Assert) {
    this.registerModifier('parent', Insertable('parent'));
    this.registerModifier('child', Insertable('child'));

    this.render('<div {{parent}}><div {{child}}></div></div>');
    assert.expect(['child: didInsertElement', 'parent: didInsertElement']);
  }

  @test
  'parent -> child destruction order'(assert: Assert) {
    this.registerModifier('parent', Insertable('parent'));
    this.registerModifier('child', Insertable('child'));

    this.render('{{#if this.nuke}}<div {{parent}}><div {{child}}></div></div>{{/if}}', {
      nuke: true,
    });
    assert.expect(['child: didInsertElement', 'parent: didInsertElement']);
    this.rerender({ nuke: false });
    assert.expect(['child: willDestroyElement', 'parent: willDestroyElement']);
  }

  @test
  'sibling insertion and destruction order'(assert: Assert) {
    this.registerModifier('parent', Insertable('parent'));
    this.registerModifier('child1', Insertable('child1'));
    this.registerModifier('child2', Insertable('child2'));

    this.render(
      '{{#if this.nuke}}<div {{parent}}><div {{child1}}></div><div {{child2}}></div></div>{{/if}}',
      {
        nuke: true,
      }
    );
    assert.verifyActions([
      'child1: didInsertElement',
      'child2: didInsertElement',
      'parent: didInsertElement',
    ]);
    this.rerender({ nuke: false });
    assert.verifyActions([
      'child1: willDestroyElement',
      'child2: willDestroyElement',
      'parent: willDestroyElement',
    ]);
  }

  @test
  'with params'(assert: Assert) {
    this.registerModifier('with-params', Insertable('with-params'));
    this.render('<div {{with-params this.first}}></div>', { first: 'first' });
    assert.verifyActions(['[with-params] didInsertElement("first")']);
    this.rerender({ first: 'updated-first' });
    assert.verifyActions(['[with-params] didUpdate("updated-first")']);
  }

  @test
  'with hash'(assert: Assert) {
    this.registerModifier('with-hash', Insertable('with-hash'));
    this.render('<div {{with-hash named=this.named}}></div>', { named: 'initial' });
    assert.expect(['[with-hash] didInsertElement(named="initial")']);
    this.rerender({ named: 'updated' });
    assert.expect(['[with-hash] didUpdate(named="updated")']);

    this.destroy();
    assert.expect(['[with-hash] willDestroyElement']);
  }

  @test
  'with hash and params'(assert: Assert) {
    this.registerModifier('with-params-and-hash', Insertable('with-params-and-hash'));
    this.render('<div {{with-params-and-hash this.positional named=this.named}}></div>', {
      positional: 'initial-positional',
      named: 'initial-named',
    });
    assert.expect([
      '[with-params-and-hash] didInsertElement("initial-positional", named="initial-named")',
    ]);
    this.rerender({ bar: 'foo', baz: 'foo' });

    this.destroy();
    assert.expect(['[with-params-and-hash] willDestroyElement']);
  }
}

function Insertable(name: string) {
  return class Insertable extends AbstractInsertable {
    didInsertElement(positional: unknown[], named: Dict) {
      QUnit.assert.action(`[${name}] didInsertElement${formatArgs(positional, named)}`);
    }

    override didUpdate(positional: unknown[], named: Dict) {
      QUnit.assert.action(`[${name}] didUpdate${formatArgs(positional, named)}`);
    }

    override willDestroyElement(): void {
      QUnit.assert.action(`[${name}] willDestroyElement`);
    }
  };
}

function formatArgs(params: unknown[], namedArgs: Dict) {
  let args: string[] = [];
  if (params.length > 0) args.push(...params.map((p) => JSON.stringify(p)));
  if (Object.keys(namedArgs).length > 0)
    args.push(...Object.entries(namedArgs).map(([k, v]) => `${k}=${JSON.stringify(v)}`));

  return args.length === 0 ? '' : `(${args.join(', ')})`;
}

jitSuite(ModifierTests);
