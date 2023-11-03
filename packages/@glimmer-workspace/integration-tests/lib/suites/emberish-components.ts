import type { SimpleElement } from '@glimmer/interfaces';
import { unwrap } from '@glimmer/util';

import { EmberishCurlyComponent } from '../components';
import { assertEmberishElement, classes } from '../dom/assertions';
import { assertingElement, toInnerHTML } from '../dom/simple-utils';
import { RenderTestContext } from '../render-test';
import { equalTokens } from '../snapshot';
import { render, suite } from '../test-decorator';
import { defineComponent } from '../test-helpers/define';
import type { RenderTestState } from '../test-helpers/module';

@suite('Emberish', 'curly')
export class EmberishComponentTests extends RenderTestContext {
  @render
  'Element modifier with hooks'(assert: RenderTestState) {
    const { events } = assert;

    this.register.modifier(
      'foo',
      class {
        element?: SimpleElement;
        didInsertElement() {
          events.record('didInsertElement');
          assert.ok(this.element, 'didInsertElement');
          assert.strictEqual(
            unwrap(this.element).getAttribute('data-ok'),
            'true',
            'didInsertElement'
          );
        }

        didUpdate() {
          events.record('didUpdate');
          assert.ok(true, 'didUpdate');
        }

        willDestroyElement() {
          events.record('willDestroyElement');
          assert.ok(true, 'willDestroyElement');
        }
      }
    );

    this.render.template('{{#if this.ok}}<div data-ok=true {{foo this.bar}}></div>{{/if}}', {
      bar: 'bar',
      ok: true,
    });

    events.expect(['didInsertElement']);

    this.rerender({ bar: 'foo' });
    events.expect(['didUpdate']);

    this.rerender({ ok: false });
    events.expect(['willDestroyElement']);
  }

  @render
  'non-block without properties'() {
    this.render.template({
      layout: 'In layout',
    });

    this.assertComponent('In layout');
    this.assertStableRerender();
  }

  @render
  'block without properties'() {
    this.render.template({
      layout: 'In layout -- {{yield}}',
      template: 'In template',
    });

    this.assertComponent('In layout -- In template');
    this.assertStableRerender();
  }

  @render
  'yield inside a conditional on the component'() {
    this.render.template(
      {
        layout: 'In layout -- {{#if @predicate}}{{yield}}{{/if}}',
        template: 'In template',
        args: { predicate: 'this.predicate' },
      },
      { predicate: true }
    );

    this.assertComponent('In layout -- In template', {});
    this.assertStableRerender();

    this.rerender({ predicate: false });
    this.assertComponent('In layout -- <!---->');
    this.assertStableNodes();

    this.rerender({ predicate: true });
    this.assertComponent('In layout -- In template', {});
    this.assertStableNodes();
  }

  @render
  'non-block with properties on attrs'() {
    this.render.template({
      layout: 'In layout - someProp: {{@someProp}}',
      args: { someProp: '"something here"' },
    });

    this.assertComponent('In layout - someProp: something here');
    this.assertStableRerender();
  }

  @render
  'block with properties on attrs'() {
    this.render.template({
      layout: 'In layout - someProp: {{@someProp}} - {{yield}}',
      template: 'In template',
      args: { someProp: '"something here"' },
    });

    this.assertComponent('In layout - someProp: something here - In template');
    this.assertStableRerender();
  }

  @render({ invokeAs: 'glimmer' })
  'with ariaRole specified'() {
    this.render.template({
      layout: 'Here!',
      attributes: { id: '"aria-test"', role: '"main"' },
    });

    this.assertComponent('Here!', { id: 'aria-test', role: 'main' });
    this.assertStableRerender();
  }

  @render({ invokeAs: 'glimmer' })
  'with ariaRole and class specified'() {
    this.render.template(
      {
        layout: 'Here!',
        attributes: { id: '"aria-test"', class: '"foo"', role: 'this.ariaRole' },
      },
      { ariaRole: 'main' }
    );

    this.assertComponent('Here!', {
      id: 'aria-test',
      class: classes('ember-view foo'),
      role: 'main',
    });
    this.assertStableRerender();
  }

  @render({ invokeAs: 'glimmer' })
  'with ariaRole specified as an outer binding'() {
    this.render.template(
      {
        layout: 'Here!',
        attributes: { id: '"aria-test"', class: '"foo"', role: 'this.ariaRole' },
      },
      { ariaRole: 'main' }
    );

    this.assertComponent('Here!', {
      id: 'aria-test',
      class: classes('ember-view foo'),
      role: 'main',
    });
    this.assertStableRerender();
  }

  @render('glimmer')
  'glimmer component with role specified as an outer binding and copied'() {
    const TestComponent = defineComponent({}, `<div ...attributes>Here!</div>`);

    const component = defineComponent(
      { myRole: 'main', TestComponent },
      `<TestComponent id="aria-test" role={{myRole}}></TestComponent>`
    );

    this.render.component(component);

    // this.render.template(
    //   {
    //     layout: 'Here!',
    //     attributes: { id: '"aria-test"', role: 'this.myRole' },
    //   },
    //   { myRole: 'main' }
    // );

    this.assertComponent('Here!', { id: 'aria-test', role: 'main' });
    this.assertStableRerender();
  }

  @render('curly')
  'invoking wrapped layout via angle brackets applies ...attributes'() {
    this.register.component('Curly', 'FooBar', 'Hello world!');

    this.render.template(`<FooBar data-foo="bar" />`);

    this.assertComponent('Hello world!', { 'data-foo': 'bar' });
    this.assertStableRerender();
  }

  @render('curly')
  'invoking wrapped layout via angle brackets - invocation attributes clobber internal attributes'() {
    class FooBar extends EmberishCurlyComponent {
      [index: string]: unknown;

      constructor() {
        super();
        this.attributeBindings = ['data-foo'];
        this['data-foo'] = 'inner';
      }
    }
    this.register.component('Curly', 'FooBar', 'Hello world!', FooBar);

    this.render.template(`<FooBar data-foo="outer" />`);

    this.assertComponent('Hello world!', { 'data-foo': 'outer' });
    this.assertStableRerender();
  }

  // LOCKS
  @render('curly')
  'yields named block'() {
    class FooBar extends EmberishCurlyComponent {
      [index: string]: unknown;

      constructor() {
        super();
      }
    }
    this.register.component('Curly', 'FooBar', 'Hello{{yield to="baz"}}world!', FooBar);

    this.render.template(`<FooBar><:baz> my </:baz></FooBar>`);

    this.assertComponent('Hello my world!');
    this.assertStableRerender();
  }

  // LOCKS
  @render('curly')
  'implicit default named block'() {
    class FooBar extends EmberishCurlyComponent {
      [index: string]: unknown;

      constructor() {
        super();
      }
    }
    this.register.component('Curly', 'FooBar', 'Hello{{yield}}world!', FooBar);

    this.render.template(`<FooBar> my </FooBar>`);

    this.assertComponent('Hello my world!');
    this.assertStableRerender();
  }

  // LOCKS
  @render('curly')
  'explicit default named block'() {
    class FooBar extends EmberishCurlyComponent {
      [index: string]: unknown;

      constructor() {
        super();
      }
    }
    this.register.component('Curly', 'FooBar', 'Hello{{yield to="default"}}world!', FooBar);

    this.render.template(`<FooBar><:default> my </:default></FooBar>`);

    this.assertComponent('Hello my world!');
    this.assertStableRerender();
  }

  // LOCKS
  @render('curly')
  'else named block'() {
    class FooBar extends EmberishCurlyComponent {
      [index: string]: unknown;

      constructor() {
        super();
      }
    }
    this.register.component('Curly', 'FooBar', 'Hello{{yield "my" to="inverse"}}world!', FooBar);

    this.render.template(`<FooBar><:else as |value|> {{value}} </:else></FooBar>`);

    this.assertComponent('Hello my world!');
    this.assertStableRerender();
  }

  @render('curly')
  'inverse named block'() {
    class FooBar extends EmberishCurlyComponent {
      [index: string]: unknown;

      constructor() {
        super();
      }
    }
    this.register.component('Curly', 'FooBar', 'Hello{{yield "my" to="inverse"}}world!', FooBar);

    this.render.template(`<FooBar><:inverse as |value|> {{value}} </:inverse></FooBar>`);

    this.assertComponent('Hello my world!');
    this.assertStableRerender();
  }

  @render('curly')
  'invoking wrapped layout via angle brackets - invocation attributes merges classes'() {
    class FooBar extends EmberishCurlyComponent {
      [index: string]: unknown;

      constructor() {
        super();
        this.attributeBindings = ['class'];
        this['class'] = 'inner';
      }
    }
    this.register.component('Curly', 'FooBar', 'Hello world!', FooBar);

    this.render.template(`<FooBar class="outer" />`);

    this.assertComponent('Hello world!', { class: classes('ember-view inner outer') });
    this.assertStableRerender();
  }

  @render('curly')
  'invoking wrapped layout via angle brackets also applies explicit ...attributes'() {
    this.register.component('Curly', 'FooBar', '<h1 ...attributes>Hello world!</h1>');

    this.render.template(`<FooBar data-foo="bar" />`);

    let wrapperElement = assertingElement(this.element.firstChild);
    assertEmberishElement(wrapperElement, 'div', { 'data-foo': 'bar' });
    equalTokens(toInnerHTML(wrapperElement), '<h1 data-foo="bar">Hello world!</h1>');

    this.assertStableRerender();
  }
}
