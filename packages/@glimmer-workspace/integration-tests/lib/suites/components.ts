import type { Dict, Owner } from '@glimmer/interfaces';

import { GlimmerishComponent } from '../components';
import { assertElementShape } from '../dom/assertions';
import { assertingElement } from '../dom/simple-utils';
import { RenderTestContext } from '../render-test';
import { render, suite } from '../test-decorator';
import { strip, stripTight } from '../test-helpers/strings';
import { tracked } from '../test-helpers/tracked';

@suite('TemplateOnly', { kind: 'templateOnly' })
export class TemplateOnlyComponents extends RenderTestContext {
  @render
  'creating a new component'() {
    this.render.template(
      {
        name: 'MyComponent',
        layout: '{{yield}} - {{@color}}',
        template: 'hello!',
        args: { color: 'this.color' },
      },
      { color: 'red' }
    );

    this.assertHTML(`<div>hello! - red</div>`);
    this.assertStableRerender();

    this.rerender({ color: 'green' });
    this.assertHTML(`<div>hello! - green</div>`);
    this.assertStableNodes();

    this.rerender({ color: 'red' });
    this.assertHTML(`<div>hello! - red</div>`);
    this.assertStableNodes();
  }

  @render
  'inner ...attributes'() {
    this.render.template(
      {
        name: 'MyComponent',
        layout: '<span ...attributes>{{yield}} - {{@color}}</span>',
        template: 'hello!',
        args: { color: 'this.color' },
        attributes: { color: 'this.color' },
      },
      { color: 'red' }
    );

    this.assertHTML(`<div><span color='red'>hello! - red</span></div>`);
    this.assertStableRerender();

    this.rerender({ color: 'green' });
    this.assertHTML(`<div><span color='green'>hello! - green</span></div>`);
    this.assertStableNodes();

    this.rerender({ color: 'red' });
    this.assertHTML(`<div><span color='red'>hello! - red</span></div>`);
    this.assertStableNodes();
  }
}

@suite('Glimmerish', { kind: 'glimmer' })
export class GlimmerishComponents extends RenderTestContext {
  @render
  'invoking dynamic component (named arg) via angle brackets'() {
    this.register.component('Glimmer', 'Foo', 'hello world!');
    this.render.template({
      layout: '<@foo />',
      args: {
        foo: 'component "Foo"',
      },
    });

    this.assertHTML(`<div>hello world!</div>`);
    this.assertStableRerender();
  }

  @render
  'invoking dynamic component (named arg path) via angle brackets'() {
    this.register.helper('hash', (_positional, named) => named);
    this.register.component('Glimmer', 'Foo', 'hello world!');
    this.render.template({
      layout: '<@stuff.Foo />',
      args: {
        stuff: 'hash Foo=(component "Foo")',
      },
    });

    this.assertHTML(`<div>hello world!</div>`);
    this.assertStableRerender();
  }

  @render
  'invoking curried component with attributes via angle brackets (invocation attributes clobber)'() {
    this.register.helper('hash', (_positional, named) => named);
    this.register.component(
      'Glimmer',
      'Foo',
      '<p data-foo="default" ...attributes>hello world!</p>'
    );
    this.render.template({
      layout: '<@stuff.Foo data-foo="invocation" />',
      args: {
        stuff: 'hash Foo=(component "Foo")',
      },
    });

    this.assertHTML(`<div><p data-foo="invocation">hello world!</p></div>`);
    this.assertStableRerender();
  }

  @render
  'invoking curried component with attributes via angle brackets (invocation classes merge)'() {
    this.register.helper('hash', (_positional, named) => named);
    this.register.component('Glimmer', 'Foo', '<p class="default" ...attributes>hello world!</p>');
    this.render.template({
      layout: '<@stuff.Foo class="invocation" />',
      args: {
        stuff: 'hash Foo=(component "Foo")',
      },
    });

    this.assertHTML(`<div><p class="default invocation">hello world!</p></div>`);
    this.assertStableRerender();
  }

  @render
  'invoking dynamic component (named arg) via angle brackets supports attributes (invocation attributes clobber)'() {
    this.register.component(
      'Glimmer',
      'Foo',
      '<div data-test="default" ...attributes>hello world!</div>'
    );
    this.render.template({
      layout: '<@foo data-test="foo"/>',
      args: {
        foo: 'component "Foo"',
      },
    });

    this.assertHTML(`<div><div data-test="foo">hello world!</div></div>`);
    this.assertStableRerender();
  }

  @render
  'invoking dynamic component (named arg) via angle brackets supports attributes'() {
    this.register.component('Glimmer', 'Foo', '<div ...attributes>hello world!</div>');
    this.render.template({
      layout: '<@foo data-test="foo"/>',
      args: {
        foo: 'component "Foo"',
      },
    });

    this.assertHTML(`<div><div data-test="foo">hello world!</div></div>`);
    this.assertStableRerender();
  }

  @render
  'invoking dynamic component (named arg) via angle brackets supports args'() {
    this.register.component('Glimmer', 'Foo', 'hello {{@name}}!');
    this.render.template({
      layout: '<@foo @name="world" />',
      args: {
        foo: 'component "Foo"',
      },
    });

    this.assertHTML(`<div>hello world!</div>`);
    this.assertStableRerender();
  }

  @render
  'invoking dynamic component (named arg) via angle brackets supports passing a block'() {
    this.register.component('Glimmer', 'Foo', 'hello {{yield}}!');
    this.render.template({
      layout: '<@foo>world</@foo>',
      args: {
        foo: 'component "Foo"',
      },
    });

    this.assertHTML(`<div>hello world!</div>`);
    this.assertStableRerender();
  }

  @render
  'invoking dynamic component (named arg) via angle brackets supports args and attributes'() {
    let instance = this.capture<Foo>();

    class Foo extends GlimmerishComponent {
      @tracked localProperty: string;

      constructor(owner: Owner, args: Dict) {
        super(owner, args);
        instance.capture(this);
        this.localProperty = 'local';
      }
    }
    this.register.component(
      'Glimmer',
      'Foo',
      '<div ...attributes>[{{this.localProperty}} {{@staticNamedArg}} {{@dynamicNamedArg}}]</div>',
      Foo
    );

    this.render.template(
      {
        layout: stripTight`<@foo @staticNamedArg="static" data-test1={{@outerArg}} data-test2="static" @dynamicNamedArg={{@outerArg}} />`,
        args: {
          foo: 'component "Foo"',
          outerArg: 'this.outer',
        },
      },
      { outer: 'outer' }
    );

    this.assertHTML(
      `<div><div data-test1="outer" data-test2="static">[local static outer]</div></div>`
    );
    this.assertStableRerender();

    this.rerender({ outer: 'OUTER' });
    this.assertHTML(
      `<div><div data-test1="OUTER" data-test2="static">[local static OUTER]</div></div>`
    );

    instance.captured.localProperty = 'LOCAL';
    this.rerender();
    this.assertHTML(
      `<div><div data-test1="OUTER" data-test2="static">[LOCAL static OUTER]</div></div>`
    );

    instance.captured.localProperty = 'local';
    this.rerender({ outer: 'outer' });
    this.assertHTML(
      `<div><div data-test1="outer" data-test2="static">[local static outer]</div></div>`
    );
  }

  @render
  'invoking dynamic component (local) via angle brackets'() {
    this.register.component('Glimmer', 'Foo', 'hello world!');
    this.render.template(`{{#with (component 'Foo') as |Other|}}<Other />{{/with}}`);

    this.assertHTML(`hello world!`);
    this.assertStableRerender();
  }

  @render
  'invoking dynamic component (local path) via angle brackets'() {
    this.register.helper('hash', (_positional, named) => named);
    this.register.component('Glimmer', 'Foo', 'hello world!');
    this.render.template(`{{#with (hash Foo=(component 'Foo')) as |Other|}}<Other.Foo />{{/with}}`);

    this.assertHTML(`hello world!`);
    this.assertStableRerender();
  }

  @render
  'invoking dynamic component (local) via angle brackets (ill-advised "htmlish element name" but supported)'() {
    this.register.component('Glimmer', 'Foo', 'hello world!');
    this.render.template(`{{#with (component 'Foo') as |div|}}<div />{{/with}}`);

    this.assertHTML(`hello world!`);
    this.assertStableRerender();
  }

  @render
  'invoking dynamic component (local) via angle brackets supports attributes'() {
    this.register.component('Glimmer', 'Foo', '<div ...attributes>hello world!</div>');
    this.render.template(
      `{{#with (component 'Foo') as |Other|}}<Other data-test="foo" />{{/with}}`
    );

    this.assertHTML(`<div data-test="foo">hello world!</div>`);
    this.assertStableRerender();
  }

  @render
  'invoking dynamic component (local) via angle brackets supports args'() {
    this.register.component('Glimmer', 'Foo', 'hello {{@name}}!');
    this.render.template(`{{#with (component 'Foo') as |Other|}}<Other @name="world" />{{/with}}`);

    this.assertHTML(`hello world!`);
    this.assertStableRerender();
  }

  @render
  'invoking dynamic component (local) via angle brackets supports passing a block'() {
    this.register.component('Glimmer', 'Foo', 'hello {{yield}}!');
    this.render.template(`{{#with (component 'Foo') as |Other|}}<Other>world</Other>{{/with}}`);

    this.assertHTML(`hello world!`);
    this.assertStableRerender();
  }

  @render
  'invoking dynamic component (local) via angle brackets supports args, attributes, and blocks'() {
    let instance = this.capture<Foo>();
    class Foo extends GlimmerishComponent {
      @tracked localProperty: string;

      constructor(owner: Owner, args: Dict) {
        super(owner, args);
        instance.capture(this);
        this.localProperty = 'local';
      }
    }
    this.register.component(
      'Glimmer',
      'Foo',
      '<div ...attributes>[{{this.localProperty}} {{@staticNamedArg}} {{@dynamicNamedArg}}] - {{yield}}</div>',
      Foo
    );
    this.render.template(
      `{{#with (component 'Foo') as |Other|}}<Other @staticNamedArg="static" data-test1={{this.outer}} data-test2="static" @dynamicNamedArg={{this.outer}}>template</Other>{{/with}}`,
      { outer: 'outer' }
    );

    this.assertHTML(
      `<div data-test1="outer" data-test2="static">[local static outer] - template</div>`
    );
    this.assertStableRerender();

    this.rerender({ outer: 'OUTER' });
    this.assertHTML(
      `<div data-test1="OUTER" data-test2="static">[local static OUTER] - template</div>`
    );

    instance.captured.localProperty = 'LOCAL';
    this.rerender();
    this.assertHTML(
      `<div data-test1="OUTER" data-test2="static">[LOCAL static OUTER] - template</div>`
    );

    instance.captured.localProperty = 'local';
    this.rerender({ outer: 'outer' });
    this.assertHTML(
      `<div data-test1="outer" data-test2="static">[local static outer] - template</div>`
    );
  }

  @render
  'invoking dynamic component (path) via angle brackets'() {
    this.register.component('Glimmer', 'TestHarness', '<this.args.Foo />');
    this.register.component('Glimmer', 'Foo', 'hello world!');

    this.render.template('<TestHarness @Foo={{component "Foo"}} />');

    this.assertHTML(`hello world!`);
    this.assertStableRerender();
  }

  @render
  'invoking dynamic component (path) via angle brackets does not work for string'() {
    this.register.component('Glimmer', 'TestHarness', '<this.args.Foo />');
    this.register.component('Glimmer', 'Foo', 'hello world!');

    this.assert.throws(() => {
      this.render.template('<TestHarness @Foo="Foo" />');
    }, /Expected a component definition, but received Foo. You may have accidentally done <this.args.Foo>, where "this.args.Foo" was a string instead of a curried component definition. You must either use the component definition directly, or use the \{\{component\}\} helper to create a curried component definition when invoking dynamically/u);
  }

  @render
  'invoking dynamic component (path) via angle brackets with named block'() {
    this.register.component(
      'Glimmer',
      'TestHarness',
      '<this.args.Foo><:bar>Stuff!</:bar></this.args.Foo>'
    );
    this.register.component('Glimmer', 'Foo', '{{yield to="bar"}}');

    this.render.template('<TestHarness @Foo={{component "Foo"}} />');

    this.assertHTML(`Stuff!`);
    this.assertStableRerender();
  }

  @render
  'invoking dynamic component (path) via angle brackets does not support implicit `this` fallback'() {
    this.assert.throws(() => {
      this.register.component('TemplateOnly', 'Test', '<stuff.Foo />');
    }, /stuff is not in scope/u);
  }

  @render
  'invoking dynamic component (path) via angle brackets supports attributes'() {
    class TestHarness extends GlimmerishComponent {
      public Foo: any;

      constructor(owner: Owner, args: Dict) {
        super(owner, args);
        this.Foo = args['Foo'];
      }
    }
    this.register.component('Glimmer', 'TestHarness', '<this.Foo data-test="foo"/>', TestHarness);
    this.register.component('Glimmer', 'Foo', '<div ...attributes>hello world!</div>');
    this.render.template('<TestHarness @Foo={{component "Foo"}} />');

    this.assertHTML(`<div data-test="foo">hello world!</div>`);
    this.assertStableRerender();
  }

  @render
  'invoking dynamic component (path) via angle brackets supports args'() {
    class TestHarness extends GlimmerishComponent {
      public Foo: any;

      constructor(owner: Owner, args: Dict) {
        super(owner, args);
        this.Foo = args['Foo'];
      }
    }
    this.register.component('Glimmer', 'TestHarness', '<this.Foo @name="world"/>', TestHarness);
    this.register.component('Glimmer', 'Foo', 'hello {{@name}}!');
    this.render.template('<TestHarness @Foo={{component "Foo"}} />');

    this.assertHTML(`hello world!`);
    this.assertStableRerender();
  }

  @render
  'invoking dynamic component (path) via angle brackets supports passing a block'() {
    class TestHarness extends GlimmerishComponent {
      public Foo: any;

      constructor(owner: Owner, args: Dict) {
        super(owner, args);
        this.Foo = args['Foo'];
      }
    }
    this.register.component('Glimmer', 'TestHarness', '<this.Foo>world</this.Foo>', TestHarness);
    this.register.component('Glimmer', 'Foo', 'hello {{yield}}!');
    this.render.template('<TestHarness @Foo={{component "Foo"}} />');

    this.assertHTML(`hello world!`);
    this.assertStableRerender();
  }

  @render
  'invoking dynamic component (path) via angle brackets supports args, attributes, and blocks'() {
    let instance = this.capture<Foo>();

    class TestHarness extends GlimmerishComponent {
      public Foo: any;

      constructor(owner: Owner, args: Dict) {
        super(owner, args);
        this.Foo = args['Foo'];
      }
    }

    class Foo extends GlimmerishComponent {
      @tracked localProperty: string;

      constructor(owner: Owner, args: Dict) {
        super(owner, args);
        instance.capture(this);
        this.localProperty = 'local';
      }
    }
    this.register.component(
      'Glimmer',
      'TestHarness',
      '<this.Foo @staticNamedArg="static" data-test1={{@outer}} data-test2="static" @dynamicNamedArg={{@outer}}>template</this.Foo>',
      TestHarness
    );
    this.register.component(
      'Glimmer',
      'Foo',
      '<div ...attributes>[{{this.localProperty}} {{@staticNamedArg}} {{@dynamicNamedArg}}] - {{yield}}</div>',
      Foo
    );
    this.render.template('<TestHarness @outer={{this.outer}} @Foo={{component "Foo"}} />', {
      outer: 'outer',
    });

    this.assertHTML(
      `<div data-test1="outer" data-test2="static">[local static outer] - template</div>`
    );
    this.assertStableRerender();

    this.rerender({ outer: 'OUTER' });
    this.assertHTML(
      `<div data-test1="OUTER" data-test2="static">[local static OUTER] - template</div>`
    );

    instance.captured.localProperty = 'LOCAL';
    this.rerender();
    this.assertHTML(
      `<div data-test1="OUTER" data-test2="static">[LOCAL static OUTER] - template</div>`
    );

    instance.captured.localProperty = 'local';
    this.rerender({ outer: 'outer' });
    this.assertHTML(
      `<div data-test1="outer" data-test2="static">[local static outer] - template</div>`
    );
  }

  @render
  'angle bracket invocation can pass forward ...attributes to a nested component'() {
    this.register.component('Glimmer', 'Qux', '<div data-from-qux ...attributes></div>');
    this.register.component('Glimmer', 'Bar', '<Qux data-from-bar ...attributes />');
    this.register.component('Glimmer', 'Foo', '<Bar data-from-foo ...attributes />');

    this.render.template('<Foo data-from-top />');
    this.assertHTML('<div data-from-qux data-from-bar data-from-foo data-from-top></div>');
  }

  @render
  'angle bracket invocation can allow invocation side to override attributes with ...attributes'() {
    this.register.component('Glimmer', 'Qux', '<div id="qux" ...attributes />');
    this.register.component('Glimmer', 'Bar', '<Qux id="bar" ...attributes />');
    this.register.component('Glimmer', 'Foo', '<Bar id="foo" ...attributes />');

    this.render.template('<Foo id="top" />');
    this.assertHTML('<div id="top"></div>');
  }

  @render
  'angle bracket invocation can allow invocation side to override the type attribute with ...attributes'() {
    this.register.component('Glimmer', 'Qux', '<div type="qux" ...attributes />');
    this.register.component('Glimmer', 'Bar', '<Qux type="bar" ...attributes />');
    this.register.component('Glimmer', 'Foo', '<Bar type="foo" ...attributes />');

    this.render.template('<Foo type="top" />');
    this.assertHTML('<div type="top"></div>');
  }

  @render
  'angle bracket invocation can override invocation side attributes with ...attributes'() {
    this.register.component('Glimmer', 'Qux', '<div ...attributes id="qux" />');
    this.register.component('Glimmer', 'Bar', '<Qux ...attributes id="bar" />');
    this.register.component('Glimmer', 'Foo', '<Bar ...attributes id="foo" />');

    this.render.template('<Foo id="top" />');
    this.assertHTML('<div id="qux"></div>');
  }

  @render
  'angle bracket invocation can override invocation side type attribute with ...attributes'() {
    this.register.component('Glimmer', 'Qux', '<div ...attributes type="qux" />');
    this.register.component('Glimmer', 'Bar', '<Qux ...attributes type="bar" />');
    this.register.component('Glimmer', 'Foo', '<Bar ...attributes type="foo" />');

    this.render.template('<Foo type="top" />');
    this.assertHTML('<div type="qux"></div>');
  }

  @render
  'angle bracket invocation can forward classes before ...attributes to a nested component'() {
    this.register.component('Glimmer', 'Qux', '<div class="qux" ...attributes />');
    this.register.component('Glimmer', 'Bar', '<Qux class="bar" ...attributes />');
    this.register.component('Glimmer', 'Foo', '<Bar class="foo" ...attributes />');

    this.render.template('<Foo class="top" />');
    this.assertHTML('<div class="qux bar foo top"></div>');
  }

  @render
  'angle bracket invocation can forward classes after ...attributes to a nested component'() {
    this.register.component('Glimmer', 'Qux', '<div ...attributes class="qux" />');
    this.register.component('Glimmer', 'Bar', '<Qux ...attributes class="bar" />');
    this.register.component('Glimmer', 'Foo', '<Bar ...attributes class="foo" />');

    this.render.template('<Foo class="top" />');
    this.assertHTML('<div class="top foo bar qux"></div>');
  }

  @render
  '[BUG: #644 popping args should be balanced]'() {
    class MainComponent extends GlimmerishComponent {
      salutation = 'Glimmer';
    }
    this.register.component(
      'Glimmer',
      'Main',
      '<div><HelloWorld @name={{this.salutation}} /></div>',
      MainComponent
    );
    this.register.component('Glimmer', 'HelloWorld', '<h1>Hello {{@name}}!</h1>');
    this.render.template('<Main />');
    this.assertHTML('<div><h1>Hello Glimmer!</h1></div>');
  }

  @render
  'Only one arg reference is created per argument'() {
    let count = 0;

    this.register.helper('count', () => count++);

    class MainComponent extends GlimmerishComponent {
      salutation = 'Glimmer';
    }
    this.register.component(
      'Glimmer',
      'Main',
      '<div><Child @value={{(count)}} /></div>',
      MainComponent
    );
    this.register.component('Glimmer', 'Child', '{{@value}} {{this.args.value}}');
    this.render.template('<Main />');
    this.assertHTML('<div>0 0</div>');
  }

  @render
  '[BUG] Gracefully handles application of curried args when invoke starts with 0 args'() {
    class MainComponent extends GlimmerishComponent {
      salutation = 'Glimmer';
    }
    this.register.component(
      'Glimmer',
      'Main',
      '<div><HelloWorld @a={{@a}} as |wat|>{{wat}}</HelloWorld></div>',
      MainComponent
    );
    this.register.component('Glimmer', 'HelloWorld', '{{yield (component "A" a=@a)}}');
    this.register.component('Glimmer', 'A', 'A {{@a}}');
    this.render.template('<Main @a={{this.a}} />', { a: 'a' });
    this.assertHTML('<div>A a</div>');
    this.assertStableRerender();
    this.rerender({ a: 'A' });
    this.assertHTML('<div>A A</div>');
    this.assertStableNodes();
  }

  @render
  'Static block component helper'() {
    this.register.component(
      'Glimmer',
      'A',
      'A {{#component "B" arg1=@one arg2=@two arg3=@three}}{{/component}}'
    );
    this.register.component('Glimmer', 'B', 'B {{@arg1}} {{@arg2}} {{@arg3}}');
    this.render.template('<A @one={{this.first}} @two={{this.second}} @three={{this.third}} />', {
      first: 1,
      second: 2,
      third: 3,
    });
    this.assertHTML('A B 1 2 3');
    this.assertStableRerender();
    this.rerender({ first: 2, second: 3, third: 4 });
    this.assertHTML('A B 2 3 4');
    this.assertStableNodes();
  }

  @render
  'Static inline component helper'() {
    this.register.component('Glimmer', 'A', 'A {{component "B" arg1=@one arg2=@two arg3=@three}}');
    this.register.component('Glimmer', 'B', 'B {{@arg1}} {{@arg2}} {{@arg3}}');
    this.render.template('<A @one={{this.first}} @two={{this.second}} @three={{this.third}} />', {
      first: 1,
      second: 2,
      third: 3,
    });
    this.assertHTML('A B 1 2 3');
    this.assertStableRerender();
    this.rerender({ first: 2, second: 3, third: 4 });
    this.assertHTML('A B 2 3 4');
    this.assertStableNodes();
  }

  @render
  'top level in-element'() {
    this.register.component('Glimmer', 'Foo', '<Bar data-bar={{@childName}} @data={{@data}} />');
    this.register.component('Glimmer', 'Bar', '<div ...attributes>Hello World</div>');

    let el = this.getInitialElement();

    this.render.template(
      strip`
    {{#each this.components key="id" as |c|}}
      {{#in-element c.mount}}
        {{component c.name childName=c.child data=c.data}}
      {{/in-element}}
    {{/each}}
    `,
      { components: [{ name: 'Foo', child: 'Bar', mount: el, data: { wat: 'Wat' } }] }
    );

    let first = assertingElement(el.firstChild);

    assertElementShape(first, 'div', { 'data-bar': 'Bar' }, 'Hello World');
    this.rerender({ components: [{ name: 'Foo', child: 'Bar', mount: el, data: { wat: 'Wat' } }] });
    assertElementShape(first, 'div', { 'data-bar': 'Bar' }, 'Hello World');
  }

  @render
  'recursive component invocation'() {
    let counter = 0;

    class RecursiveInvoker extends GlimmerishComponent {
      id: number;

      get showChildren() {
        return this.id < 3;
      }

      constructor(owner: Owner, args: Dict) {
        super(owner, args);
        this.id = ++counter;
      }
    }

    this.register.component(
      'Glimmer',
      'RecursiveInvoker',
      '{{this.id}}{{#if this.showChildren}}<RecursiveInvoker />{{/if}}',
      RecursiveInvoker
    );

    this.render.template('<RecursiveInvoker />');
    this.assertHTML('123<!---->');
  }

  @render('templateOnly')
  'throwing an error during component construction does not put result into a bad state'() {
    this.register.component(
      'Glimmer',
      'Foo',
      'Hello',
      class extends GlimmerishComponent {
        constructor(owner: Owner, args: Dict) {
          super(owner, args);
          throw new Error('something went wrong!');
        }
      }
    );

    this.render.template('{{#if this.showing}}<Foo/>{{/if}}', {
      showing: false,
    });

    this.assert.throws(() => {
      this.rerender({ showing: true });
    }, 'something went wrong!');

    this.assertHTML('<!---->', 'values rendered before the error rendered correctly');
    this.destroy();

    this.assertHTML('', 'destroys correctly');
  }

  @render('templateOnly')
  'throwing an error during component construction does not put result into a bad state with multiple prior nodes'() {
    this.register.component(
      'Glimmer',
      'Foo',
      'Hello',
      class extends GlimmerishComponent {
        constructor(owner: Owner, args: Dict) {
          super(owner, args);
          throw new Error('something went wrong!');
        }
      }
    );

    this.render.template(
      '{{#if this.showing}}<div class="first"></div><div class="second"></div><Foo/>{{/if}}',
      {
        showing: false,
      }
    );

    this.assert.throws(() => {
      this.rerender({ showing: true });
    }, 'something went wrong!');

    this.assertHTML(
      '<div class="first"></div><div class="second"></div><!---->',
      'values rendered before the error rendered correctly'
    );
    this.destroy();

    this.assertHTML('', 'destroys correctly');
  }

  @render('templateOnly')
  'throwing an error during component construction does not put result into a bad state with nested components'() {
    this.register.component(
      'Glimmer',
      'Foo',
      'Hello',
      class extends GlimmerishComponent {
        constructor(owner: Owner, args: Dict) {
          super(owner, args);
          throw new Error('something went wrong!');
        }
      }
    );

    this.register.component('TemplateOnly', 'Bar', '<div class="second"></div><Foo/>');

    this.render.template('{{#if this.showing}}<div class="first"></div><Bar/>{{/if}}', {
      showing: false,
    });

    this.assert.throws(() => {
      this.rerender({ showing: true });
    }, 'something went wrong!');

    this.assertHTML(
      '<div class="first"></div><div class="second"></div><!---->',
      'values rendered before the error rendered correctly'
    );
    this.destroy();

    this.assertHTML('', 'destroys correctly');
  }

  @render('templateOnly')
  'throwing an error during rendering gives a readable error stack'(assert: Assert) {
    // eslint-disable-next-line no-console
    let originalConsoleError = console.error;

    // eslint-disable-next-line no-console
    console.error = (message: string) => {
      this.assert.ok(
        /Error occurred:\n{2}(- While rendering:\nBar\n {2}Foo)?/u.exec(message),
        'message logged'
      );
    };

    try {
      assert.expect(7);

      this.register.component(
        'Glimmer',
        'Foo',
        'Hello',
        class extends GlimmerishComponent {
          constructor(owner: Owner, args: Dict) {
            super(owner, args);
            throw new Error('something went wrong!');
          }
        }
      );

      this.register.component('TemplateOnly', 'Bar', '<div class="second"></div><Foo/>');

      this.render.template('{{#if this.showing}}<div class="first"></div><Bar/>{{/if}}', {
        showing: false,
      });

      this.assert.throws(() => {
        this.rerender({ showing: true });
      }, /something went wrong!/u);

      this.assertHTML(
        '<div class="first"></div><div class="second"></div><!---->',
        'values rendered before the error rendered correctly'
      );
      this.destroy();

      this.assertHTML('', 'destroys correctly');
    } finally {
      // eslint-disable-next-line no-console
      console.error = originalConsoleError;
    }
  }
}
