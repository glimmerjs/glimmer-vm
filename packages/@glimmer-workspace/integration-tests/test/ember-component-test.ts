import type { Dict, Owner, SimpleElement, SimpleNode } from '@glimmer/interfaces';
import { castToSimple, unwrap } from '@glimmer/util';
import {
  classes,
  createTemplate,
  elementId,
  EmberishCurlyComponent,
  equalsElement,
  firstElementChild,
  GlimmerishComponent,
  isSimpleElement,
  jitSuite,
  regex,
  stripTight,
  test,
  BrowserRenderTest,
  capturing,
} from '@glimmer-workspace/integration-tests';
import type {
  Capturing,
  EmberishCurlyComponentFactory,
  JitRenderDelegate,
  AttributesDiff,
  Attributes,
} from '@glimmer-workspace/integration-tests';

import { assert } from './support';
import { registerDestructor } from '@glimmer/destroyable';

interface ComponentHooks {
  didInitAttrs: number;
  didUpdateAttrs: number;
  didReceiveAttrs: number;
  willInsertElement: number;
  willUpdate: number;
  willRender: number;
  didInsertElement: number;
  didUpdate: number;
  didRender: number;
}

interface HookedComponent {
  hooks: ComponentHooks;
}

export function inspecting<T extends typeof EmberishCurlyComponent>(
  ComponentClass: T
): { Class: T; instance: Capturing<InstanceType<T> & HookedComponent> } {
  let instance = capturing<InstanceType<T> & HookedComponent>();
  let Class = inspectHooks(ComponentClass, instance);

  return {
    instance,
    Class,
  };
}

function inspectHooks<T extends typeof EmberishCurlyComponent>(
  ComponentClass: T,
  capturing?: Capturing<InstanceType<T> & HookedComponent>
): T {
  return class extends (ComponentClass as any) {
    constructor(...args: unknown[]) {
      super(...args);

      (this as any).hooks = {
        didInitAttrs: 0,
        didUpdateAttrs: 0,
        didReceiveAttrs: 0,
        willInsertElement: 0,
        willUpdate: 0,
        willRender: 0,
        didInsertElement: 0,
        didUpdate: 0,
        didRender: 0,
      };

      capturing?.capture(this as InstanceType<T>);
    }

    didInitAttrs(this: any, options: { attrs: Attributes }) {
      super.didInitAttrs(options);
      this.hooks['didInitAttrs']++;
    }

    didUpdateAttrs(this: any, diff: AttributesDiff) {
      super.didUpdateAttrs(diff);
      this.hooks['didUpdateAttrs']++;
    }

    didReceiveAttrs(this: any, diff: AttributesDiff) {
      super.didReceiveAttrs(diff);
      this.hooks['didReceiveAttrs']++;
    }

    willInsertElement(this: any) {
      super.willInsertElement();
      this.hooks['willInsertElement']++;
    }

    willUpdate(this: any) {
      super.willUpdate();
      this.hooks['willUpdate']++;
    }

    willRender(this: any) {
      super.willRender();
      this.hooks['willRender']++;
    }

    didInsertElement(this: any) {
      super.didInsertElement();
      this.hooks['didInsertElement']++;
    }

    didUpdate(this: any) {
      super.didUpdate();
      this.hooks['didUpdate']++;
    }

    didRender(this: any) {
      super.didRender();
      this.hooks['didRender']++;
    }
  } as any as T;
}

function assertFired(component: HookedComponent, name: string, count = 1) {
  let hooks = component.hooks;

  if (!hooks) {
    throw new TypeError(`Not hooked: ${component}`);
  }

  if (name in hooks) {
    assert.strictEqual(
      hooks[name as keyof ComponentHooks],
      count,
      `The ${name} hook fired ${count} ${count === 1 ? 'time' : 'times'}`
    );
  } else {
    assert.ok(false, `The ${name} hook fired`);
  }
}

export function assertElementIsEmberishElement(
  element: SimpleElement | Element | null,
  tagName: string,
  attributes: Object,
  contents: string
): void;
export function assertElementIsEmberishElement(
  element: SimpleElement | Element | null,
  tagName: string,
  attributes: Object
): void;
export function assertElementIsEmberishElement(
  element: SimpleElement | Element | null,
  tagName: string,
  contents: string
): void;
export function assertElementIsEmberishElement(
  element: SimpleElement | Element | null,
  tagName: string
): void;
export function assertElementIsEmberishElement(
  element: SimpleElement | Element | null,
  ...args: any[]
): void {
  let tagName, attributes, contents;
  if (args.length === 2) {
    if (typeof args[1] === 'string') [tagName, attributes, contents] = [args[0], {}, args[1]];
    else [tagName, attributes, contents] = [args[0], args[1], null];
  } else if (args.length === 1) {
    [tagName, attributes, contents] = [args[0], {}, null];
  } else {
    [tagName, attributes, contents] = args;
  }

  let fullAttributes = {
    class: classes('ember-view'),
    id: regex(/^ember\d*$/u),
    ...attributes,
  };
  equalsElement(element, tagName, fullAttributes, contents);
}

class CurlyTest extends BrowserRenderTest {
  assertEmberishElement(tagName: string, attributes: Object, contents: string): void;
  assertEmberishElement(tagName: string, attributes: Object): void;
  assertEmberishElement(tagName: string, contents: string): void;
  assertEmberishElement(tagName: string): void;
  assertEmberishElement(...args: any[]): void {
    let tagName, attributes, contents;
    if (args.length === 2) {
      if (typeof args[1] === 'string') [tagName, attributes, contents] = [args[0], {}, args[1]];
      else [tagName, attributes, contents] = [args[0], args[1], null];
    } else if (args.length === 1) {
      [tagName, attributes, contents] = [args[0], {}, null];
    } else {
      [tagName, attributes, contents] = args;
    }

    let fullAttributes = {
      class: classes('ember-view'),
      id: regex(/^ember\d*$/u),
      ...attributes,
    };
    equalsElement(
      firstElementChild(this.element) as SimpleElement,
      tagName,
      fullAttributes,
      contents
    );
  }
}

function ElementComponent(tagName = 'div') {
  return class ElementComponent extends EmberishCurlyComponent {
    override tagName = tagName;
  };
}

class TaglessComponent extends EmberishCurlyComponent {
  override tagName = '';
}

class CurlyCreateTest extends CurlyTest {
  static suiteName = '[curly components] Manager#create - hasBlock';

  @test
  'when no block present'() {
    this.registerComponent('Curly', 'foo-bar', `{{this.HAS_BLOCK}}`, ElementComponent());

    this.render(`{{foo-bar}}`);

    this.assertEmberishElement('div', {}, `false`);
  }

  @test
  'when block present'() {
    this.registerComponent('Curly', 'foo-bar', `{{this.HAS_BLOCK}}`, ElementComponent());

    this.render(`{{#foo-bar}}{{/foo-bar}}`);

    this.assertEmberishElement('div', {}, `true`);
  }
}

class CurlyDynamicComponentTest extends CurlyTest {
  static suiteName = '[curly components] dynamic components';

  @test
  'initially missing, then present, then missing'() {
    this.registerComponent('Curly', 'FooBar', `<p>{{@arg1}}</p>`);

    this.render(
      stripTight`
        <div>
          {{component this.something arg1="hello"}}
        </div>
      `,
      {
        something: undefined,
      }
    );
    this.assertHTML('<div><!----></div>');

    this.rerender({ something: 'FooBar' });
    this.assertHTML('<div><div id="ember*" class="ember-view"><p>hello</p></div></div>');

    this.rerender({ something: undefined });
    this.assertHTML('<div><!----></div>');
  }

  @test
  'initially present, then missing, then present'() {
    this.registerComponent('Curly', 'FooBar', `<p>foo bar baz</p>`);

    this.render(
      stripTight`
        <div>
          {{component this.something}}
        </div>`,
      {
        something: 'FooBar',
      }
    );
    this.assertHTML('<div><div id="ember*" class="ember-view"><p>foo bar baz</p></div></div>');

    this.rerender({ something: undefined });
    this.assertHTML('<div><!----></div>');

    this.rerender({ something: 'FooBar' });
    this.assertHTML('<div><div id="ember*" class="ember-view"><p>foo bar baz</p></div></div>');
  }
}

function CapturingFooBar() {
  let capture = capturing<CapturingFooBar>();
  class CapturingFooBar extends EmberishCurlyComponent {
    override attributeBindings = ['style'];
    style: string | null = null;

    constructor() {
      super();
      this.style = 'color: red;';
      capture.capture(this);
    }
  }

  return { instance: capture, Class: CapturingFooBar };
}

class CurlyDynamicCustomizationTest extends CurlyTest {
  static suiteName = '[curly components] dynamic customizations';

  @test
  'dynamic tagName'() {
    let Aside = ElementComponent('aside');

    this.registerComponent('Curly', 'foo-bar', `Hello. It's me.`, Aside);

    this.render(`{{foo-bar}}`);
    this.assertEmberishElement('aside', {}, `Hello. It's me.`);
    this.assertStableRerender();
  }

  @test
  'dynamic tagless component'() {
    let { Class } = inspecting(TaglessComponent);

    this.registerComponent('Curly', 'foo-bar', `Michael Jordan says "Go Tagless"`, Class);

    this.render(`{{foo-bar}}`);
    this.assertHTML('Michael Jordan says "Go Tagless"');
    this.assertStableRerender();
  }

  @test
  'dynamic attribute bindings'() {
    let { instance, Class } = CapturingFooBar();

    this.registerComponent('Curly', 'foo-bar', `Hello. It's me.`, Class);

    this.render(`{{foo-bar}}`);
    this.assertEmberishElement('div', { style: 'color: red;' }, `Hello. It's me.`);

    this.rerender();

    assert.ok(instance.value, 'expected foo-bar to be set');
    this.assertEmberishElement('div', { style: 'color: red;' }, `Hello. It's me.`);

    instance.value.set('style', 'color: green;');
    this.rerender();

    this.assertEmberishElement('div', { style: 'color: green;' }, `Hello. It's me.`);

    instance.value.set('style', null);
    this.rerender();

    this.assertEmberishElement('div', {}, `Hello. It's me.`);

    instance.value.set('style', 'color: red;');
    this.rerender();

    this.assertEmberishElement('div', { style: 'color: red;' }, `Hello. It's me.`);
  }
}

class CurlyArgsTest extends CurlyTest {
  static suiteName = '[curly components] args';

  @test
  'using @value from emberish curly component'() {
    this.registerComponent('Curly', 'foo-bar', `{{@blah}}`, OnePositionalParamComponent());

    this.render(`{{foo-bar this.first blah="derp"}}`);

    this.assertEmberishElement('div', {}, `derp`);
  }
}

class CurlyScopeTest extends CurlyTest {
  static suiteName = '[curly components] scope';

  @test
  'correct scope - accessing local variable in yielded block (glimmer component)'() {
    this.registerComponent(
      'TemplateOnly',
      'FooBar',
      `<div>[Layout: {{this.zomg}}][Layout: {{this.lol}}][Layout: {{@foo}}]{{yield}}</div>`
    );

    this.render(
      stripTight`
        <div>
          [Outside: {{this.zomg}}]
          {{#with this.zomg as |lol|}}
            [Inside: {{this.zomg}}]
            [Inside: {{lol}}]
            <FooBar @foo={{this.zomg}}>
              [Block: {{this.zomg}}]
              [Block: {{lol}}]
            </FooBar>
          {{/with}}
        </div>`,
      { zomg: 'zomg' }
    );

    this.assertHTML(
      stripTight`
        <div>
          [Outside: zomg]
          [Inside: zomg]
          [Inside: zomg]
          <div>
            [Layout: ]
            [Layout: ]
            [Layout: zomg]
            [Block: zomg]
            [Block: zomg]
          </div>
        </div>
      `
    );
  }

  @test
  'correct scope - accessing local variable in yielded block (curly component)'() {
    this.registerComponent(
      'Curly',
      'foo-bar',
      `[Layout: {{this.zomg}}][Layout: {{this.lol}}][Layout: {{this.foo}}]{{yield}}`,
      TaglessComponent
    );

    this.render(
      stripTight`
        <div>
          [Outside: {{this.zomg}}]
          {{#with this.zomg as |lol|}}
            [Inside: {{this.zomg}}]
            [Inside: {{lol}}]
            {{#foo-bar foo=this.zomg}}
              [Block: {{this.zomg}}]
              [Block: {{lol}}]
            {{/foo-bar}}
          {{/with}}
        </div>`,
      { zomg: 'zomg' }
    );

    this.assertHTML(
      stripTight`
        <div>
          [Outside: zomg]
          [Inside: zomg]
          [Inside: zomg]
          [Layout: ]
          [Layout: ]
          [Layout: zomg]
          [Block: zomg]
          [Block: zomg]
        </div>
      `
    );
  }

  @test
  'correct scope - caller self can be threaded through (curly component)'() {
    this.registerComponent(
      'Curly',
      'parent',
      stripTight`
        [Name: {{this.name}} | Target: {{this.targetObject.name}}]
        {{#child}}
          [Name: {{this.name}} | Target: {{this.targetObject.name}}]
        {{/child}}
        [Name: {{this.name}} | Target: {{this.targetObject.name}}]
      `,
      ParentTagless
    );

    this.registerComponent(
      'Curly',
      'child',
      `[Name: {{this.name}} | Target: {{this.targetObject.name}}]{{yield}}`,
      ChildTagless
    );

    this.render(`<div>{{parent}}</div>`, {
      name: 'outer-scope',
    });

    this.assertHTML(
      stripTight`
        <div>
          [Name: foo-bar | Target: outer-scope]
          [Name: qux-derp | Target: foo-bar]
          [Name: foo-bar | Target: outer-scope]
          [Name: foo-bar | Target: outer-scope]
        </div>
      `
    );
  }

  @test
  '`false` class name do not render'() {
    this.render('<div class={{this.isFalse}}>FALSE</div>', { isFalse: false });
    this.assertHTML('<div>FALSE</div>');
  }

  @test
  '`null` class name do not render'() {
    this.render('<div class={{this.isNull}}>NULL</div>', { isNull: null });
    this.assertHTML('<div>NULL</div>');
  }

  @test
  '`undefined` class name do not render'() {
    this.render('<div class={{this.isUndefined}}>UNDEFINED</div>', { isUndefined: undefined });
    this.assertHTML('<div>UNDEFINED</div>');
  }

  @test
  '`0` class names do render'() {
    this.render('<div class={{this.isZero}}>ZERO</div>', { isZero: 0 });
    this.assertHTML('<div class="0">ZERO</div>');
  }

  @test
  'component with slashed name'() {
    this.registerComponent('Curly', 'fizz-bar/baz-bar', '{{@hey}}');
    this.render('{{fizz-bar/baz-bar hey="hello"}}');

    this.assertHTML('<div id="ember*" class="ember-view">hello</div>');
  }

  @test
  'correct scope - simple'() {
    this.registerComponent('TemplateOnly', 'SubItem', `<p>{{@name}}</p>`);

    let subitems = [{ id: 0 }, { id: 1 }, { id: 42 }];

    this.render(
      stripTight`
        <div>
          {{#each this.items key="id" as |item|}}
            <SubItem @name={{item.id}} />
          {{/each}}
        </div>`,
      { items: subitems }
    );

    this.assertHTML('<div><p>0</p><p>1</p><p>42</p></div>');
  }

  @test
  'correct scope - self lookup inside #each'() {
    this.registerComponent('TemplateOnly', 'SubItem', `<p>{{@name}}</p>`);

    let subitems = [{ id: 0 }, { id: 1 }, { id: 42 }];

    this.render(
      stripTight`
        <div>
          {{#each this.items key="id" as |item|}}
            <SubItem @name={{this.id}} />
            <SubItem @name={{this.id}} />
            <SubItem @name={{item.id}} />
          {{/each}}
        </div>`,
      { items: subitems, id: '(self)' }
    );

    this.assertHTML(
      stripTight`
        <div>
          <p>(self)</p><p>(self)</p><p>0</p>
          <p>(self)</p><p>(self)</p><p>1</p>
          <p>(self)</p><p>(self)</p><p>42</p>
        </div>
      `
    );
  }

  @test
  'correct scope - complex'() {
    this.registerComponent('TemplateOnly', 'SubItem', `<p>{{@name}}</p>`);

    this.registerComponent(
      'TemplateOnly',
      'MyItem',
      stripTight`
        <aside>{{@item.id}}:
          {{#if @item.visible}}
            {{#each @item.subitems key="id" as |subitem|}}
               <SubItem @name={{subitem.id}} />
            {{/each}}
          {{/if}}
        </aside>
      `
    );

    let itemId = 0;

    let items = [];

    for (let index = 0; index < 3; index++) {
      let subitems = [];
      let subitemId = 0;

      for (let index_ = 0; index_ < 2; index_++) {
        subitems.push({
          id: `${itemId}.${subitemId++}`,
        });
      }

      items.push({
        id: String(itemId++),
        visible: index % 2 === 0,
        subitems,
      });
    }

    this.render(
      stripTight`
        <article>{{#each this.items key="id" as |item|}}
          <MyItem @item={{item}} />
        {{/each}}</article>
      `,
      { items }
    );

    this.assertHTML(
      stripTight`
        <article>
          <aside>0:<p>0.0</p><p>0.1</p></aside>
          <aside>1:<!----></aside>
          <aside>2:<p>2.0</p><p>2.1</p></aside>
        </article>
      `
    );
  }

  @test
  'correct scope - complex yield'() {
    this.registerComponent(
      'Curly',
      'item-list',
      stripTight`
        <ul>
          {{#each this.items key="id" as |item|}}
            <li>{{item.id}}: {{yield item}}</li>
          {{/each}}
        </ul>
      `
    );

    let items = [
      { id: '1', name: 'Foo', description: 'Foo!' },
      { id: '2', name: 'Bar', description: 'Bar!' },
      { id: '3', name: 'Baz', description: 'Baz!' },
    ];

    this.render(
      stripTight`
        {{#item-list items=this.items as |item|}}
          {{item.name}}{{#if this.showDescription}} - {{item.description}}{{/if}}
        {{/item-list}}
      `,
      { items, showDescription: false }
    );

    this.assertEmberishElement(
      'div',
      stripTight`
        <ul>
          <li>1: Foo<!----></li>
          <li>2: Bar<!----></li>
          <li>3: Baz<!----></li>
        </ul>`
    );

    this.rerender({ items, showDescription: true });

    this.assertEmberishElement(
      'div',
      stripTight`
        <ul>
          <li>1: Foo - Foo!</li>
          <li>2: Bar - Bar!</li>
          <li>3: Baz - Baz!</li>
        </ul>
      `
    );
  }

  @test
  'correct scope - self'() {
    this.registerComponent(
      'Glimmer',
      'Normal',
      `<p>{{this.name}} {{this.conference}} {{@baz}}</p>`,
      NormalComponent
    );

    this.render(
      stripTight`
        <div>
          <Normal />
          <Normal @baz={{this.zomg}} />
        </div>`,
      { zomg: 'zomg' }
    );

    this.assertHTML(
      stripTight`
        <div>
          <p>Julia EmberConf </p>
          <p>Julia EmberConf zomg</p>
        </div>
      `
    );
  }
}

class DynamicScopeComponent extends EmberishCurlyComponent {
  static fromDynamicScope = ['theme'];
}

class CurlyDynamicScopeSmokeTest extends CurlyTest {
  static suiteName = '[curly components] dynamicScope access smoke test';

  @test
  'component has access to dynamic scope'() {
    this.registerComponent('Curly', 'sample-component', '{{this.theme}}', DynamicScopeComponent);

    this.render('{{#-with-dynamic-vars theme="light"}}{{sample-component}}{{/-with-dynamic-vars}}');

    this.assertEmberishElement('div', 'light');
  }
}

class CurlyPositionalArgsTest extends CurlyTest {
  static suiteName = '[curly components] positional arguments';

  @test
  'static named positional parameters'() {
    this.registerComponent(
      'Curly',
      'sample-component',
      '{{this.first}}{{this.second}}',
      TwoPositionalParamsComponent()
    );

    this.render('{{sample-component "Quint" 4}}');

    this.assertEmberishElement('div', 'Quint4');
  }

  @test
  'dynamic named positional parameters'() {
    this.registerComponent(
      'Curly',
      'sample-component',
      '{{this.first}}{{this.second}}',
      TwoPositionalParamsComponent()
    );

    this.render('{{sample-component this.myName this.myAge}}', {
      myName: 'Quint',
      myAge: 4,
    });

    this.assertEmberishElement('div', 'Quint4');

    this.rerender({
      myName: 'Edward',
      myAge: 5,
    });

    this.assertEmberishElement('div', 'Edward5');
  }

  @test
  'if a value is passed as a non-positional parameter, it takes precedence over the named one'() {
    this.registerComponent(
      'Curly',
      'sample-component',
      '{{this.names}}',
      OnePositionalParamComponent()
    );

    assert.throws(() => {
      this.render('{{sample-component this.notMyName names=this.myName}}', {
        myName: 'Quint',
        notMyName: 'Sergio',
      });
    }, 'You cannot specify both a positional param (at position 0) and the hash argument `name`.');
  }

  @test
  'static arbitrary number of positional parameters'() {
    this.registerComponent(
      'Curly',
      'sample-component',
      '{{#each this.names key="@index" as |name|}}{{name}}{{/each}}',
      OnePositionalParamComponent()
    );

    this.render(
      stripTight`
        {{sample-component "Foo" 4 "Bar"}}
        {{sample-component "Foo" 4 "Bar" 5 "Baz"}}
      `
    );

    let [first, second] = this.guardArray(
      {
        children: [this.element.firstChild, this.element.lastChild],
      },
      { min: 2, condition: isSimpleElement }
    );

    assertElementIsEmberishElement(first, 'div', 'Foo4Bar');
    assertElementIsEmberishElement(second, 'div', 'Foo4Bar5Baz');
  }

  @test
  'arbitrary positional parameter conflict with hash parameter is reported'() {
    this.registerComponent(
      'Curly',
      'sample-component',
      '{{#each this.attrs.names key="@index" as |name|}}{{name}}{{/each}}',
      OnePositionalParamComponent()
    );

    assert.throws(() => {
      this.render('{{sample-component "Foo" 4 "Bar" names=this.numbers id="args-3"}}', {
        numbers: [1, 2, 3],
      });
    }, `You cannot specify positional parameters and the hash argument \`names\`.`);
  }

  @test
  'can use hash parameter instead of arbitrary positional param [GH #12444]'() {
    this.registerComponent(
      'Curly',
      'sample-component',
      '{{#each this.name key="@index" as |name|}}{{name}}{{/each}}',
      OnePositionalParamComponent()
    );

    this.render('{{sample-component name=this.things}}', {
      things: ['Foo', 4, 'Bar'],
    });

    this.assertEmberishElement('div', 'Foo4Bar');
  }

  @test
  'can use hash parameter instead of positional param'() {
    this.registerComponent(
      'Curly',
      'sample-component',
      '{{this.first}} - {{this.second}}',
      TwoPositionalParamsComponent()
    );

    this.render(
      stripTight`
          {{sample-component "one" "two"}}
          {{sample-component "one" second="two"}}
          {{sample-component first="one" second="two"}}
      `,
      {
        things: ['Foo', 4, 'Bar'],
      }
    );

    this.assertHTML(
      stripTight`
        <div id="ember*" class="ember-view">one - two</div>
        <div id="ember*" class="ember-view">one - two</div>
        <div id="ember*" class="ember-view">one - two</div>
      `
    );
  }

  @test
  'dynamic arbitrary number of positional parameters'() {
    this.registerComponent(
      'Curly',
      'sample-component',
      '{{#each this.attrs.names key="@index" as |name|}}{{name}}{{/each}}',
      OnePositionalParamComponent()
    );

    this.render('{{sample-component this.user1 this.user2}}', {
      user1: 'Foo',
      user2: 4,
    });

    this.assertEmberishElement('div', 'Foo4');

    this.rerender({
      user1: 'Bar',
      user2: '5',
    });

    this.assertEmberishElement('div', 'Bar5');

    this.rerender({
      user2: '6',
    });

    this.assertEmberishElement('div', 'Bar6');
  }

  @test
  '{{component}} helper works with positional params'() {
    this.registerComponent(
      'Curly',
      'sample-component',
      `{{this.attrs.first}}{{this.attrs.second}}`,
      TwoPositionalParamsComponent()
    );

    this.render(`{{component "sample-component" this.myName this.myAge}}`, {
      myName: 'Quint',
      myAge: 4,
    });

    this.assertEmberishElement('div', 'Quint4');

    this.rerender({
      myName: 'Edward',
      myAge: '5',
    });

    this.assertEmberishElement('div', 'Edward5');

    this.rerender({
      myName: 'Quint',
      myAge: '4',
    });

    this.assertEmberishElement('div', 'Quint4');
  }
}

class CurlyClosureComponentsTest extends CurlyTest {
  static suiteName = '[curly components] closure components';

  @test
  'component helper can handle aliased block components with args'() {
    this.registerHelper('hash', (_positional, named) => named);
    this.registerComponent('Curly', 'foo-bar', 'Hello {{this.arg1}} {{yield}}');

    this.render(
      stripTight`
        {{#with (hash comp=(component 'foo-bar')) as |my|}}
          {{#component my.comp arg1="World!"}}Test1{{/component}} Test2
        {{/with}}
      `
    );

    this.assertHTML('<div id="ember1" class="ember-view">Hello World! Test1</div> Test2');
  }

  @test
  'component helper can handle aliased block components without args'() {
    this.registerHelper('hash', (_positional, named) => named);
    this.registerComponent('Curly', 'foo-bar', 'Hello {{yield}}');

    this.render(
      stripTight`
        {{#with (hash comp=(component 'foo-bar')) as |my|}}
          {{#component my.comp}}World!{{/component}} Test
        {{/with}}
      `
    );

    this.assertHTML('<div id="ember1" class="ember-view">Hello World!</div> Test');
  }

  @test
  'component helper can handle aliased inline components with args'() {
    this.registerHelper('hash', (_positional, named) => named);
    this.registerComponent('Curly', 'foo-bar', 'Hello {{this.arg1}}');

    this.render(
      stripTight`
        {{#with (hash comp=(component 'foo-bar')) as |my|}}
          {{component my.comp arg1="World!"}} Test
        {{/with}}
      `
    );

    this.assertHTML('<div id="ember1" class="ember-view">Hello World!</div> Test');
  }

  @test
  'component helper can handle aliased inline components without args'() {
    this.registerHelper('hash', (_positional, named) => named);
    this.registerComponent('Curly', 'foo-bar', 'Hello');

    this.render(
      stripTight`
        {{#with (hash comp=(component 'foo-bar')) as |my|}}
          {{component my.comp}} World!
        {{/with}}
      `
    );

    this.assertHTML('<div id="ember2" class="ember-view">Hello</div> World!');
  }

  @test
  'component helper can handle higher order inline components with args'() {
    this.registerHelper('hash', (_positional, named) => named);
    this.registerComponent('Curly', 'foo-bar', '{{yield (hash comp=(component "baz-bar"))}}');
    this.registerComponent('Curly', 'baz-bar', 'Hello {{this.arg1}}');

    this.render(
      stripTight`
        {{#foo-bar as |my|}}
          {{component my.comp arg1="World!"}} Test
        {{/foo-bar}}
      `
    );

    this.assertHTML(
      '<div id="ember1" class="ember-view"><div id="ember2" class="ember-view">Hello World!</div> Test</div>'
    );
  }

  @test
  'component helper can handle higher order inline components without args'() {
    this.registerHelper('hash', (_positional, named) => named);
    this.registerComponent('Curly', 'foo-bar', '{{yield (hash comp=(component "baz-bar"))}}');
    this.registerComponent('Curly', 'baz-bar', 'Hello');

    this.render(
      stripTight`
        {{#foo-bar as |my|}}
          {{component my.comp}} World!
        {{/foo-bar}}
      `
    );

    this.assertHTML(
      '<div id="ember3" class="ember-view"><div id="ember4" class="ember-view">Hello</div> World!</div>'
    );
  }

  @test
  'component helper can handle higher order block components with args'() {
    this.registerHelper('hash', (_positional, named) => named);
    this.registerComponent('Curly', 'foo-bar', '{{yield (hash comp=(component "baz-bar"))}}');
    this.registerComponent('Curly', 'baz-bar', 'Hello {{this.arg1}} {{yield}}');

    this.render(
      stripTight`
        {{#foo-bar as |my|}}
          {{#component my.comp arg1="World!"}}Test1{{/component}} Test2
        {{/foo-bar}}
      `
    );

    this.assertHTML(
      '<div id="ember*" class="ember-view"><div id="ember*" class="ember-view">Hello World! Test1</div> Test2</div>'
    );
  }

  @test
  'component helper can handle higher order block components without args'() {
    this.registerHelper('hash', (_positional, named) => named);
    this.registerComponent('Curly', 'foo-bar', '{{yield (hash comp=(component "baz-bar"))}}');
    this.registerComponent('Curly', 'baz-bar', 'Hello {{this.arg1}} {{yield}}');

    this.render(
      stripTight`
        {{#foo-bar as |my|}}
          {{#component my.comp}}World!{{/component}} Test
        {{/foo-bar}}
      `
    );

    this.assertHTML(
      '<div id="ember1" class="ember-view"><div id="ember2" class="ember-view">Hello  World!</div> Test</div>'
    );
  }

  @test
  'component deopt can handle aliased inline components without args'() {
    this.registerHelper('hash', (_positional, named) => named);
    this.registerComponent('Curly', 'foo-bar', 'Hello');

    this.render(
      stripTight`
        {{#with (hash comp=(component 'foo-bar')) as |my|}}
          {{my.comp}} World!
        {{/with}}
      `
    );

    this.assertHTML('<div id="ember1" class="ember-view">Hello</div> World!');
  }

  @test
  'component deopt can handle higher order inline components without args'() {
    this.registerHelper('hash', (_positional, named) => named);
    this.registerComponent('Curly', 'foo-bar', '{{yield (hash comp=(component "baz-bar"))}}');
    this.registerComponent('Curly', 'baz-bar', 'Hello');

    this.render(
      stripTight`
        {{#foo-bar as |my|}}
          {{my.comp}} World!
        {{/foo-bar}}
      `
    );

    this.assertHTML(
      '<div id="ember1" class="ember-view"><div id="ember2" class="ember-view">Hello</div> World!</div>'
    );
  }

  @test
  'component helper can curry arguments'() {
    this.registerComponent(
      'Curly',
      'foo-bar',
      stripTight`
        1. [{{this.one}}]
        2. [{{this.two}}]
        3. [{{this.three}}]
        4. [{{this.four}}]
        5. [{{this.five}}]
        6. [{{this.six}}]

        {{yield}}

        a. [{{this.a}}]
        b. [{{this.b}}]
        c. [{{this.c}}]
        d. [{{this.d}}]
        e. [{{this.e}}]
        f. [{{this.f}}]
      `,
      SixPositionalParamsComponent
    );

    this.render(
      stripTight`
        {{#with (component "foo-bar" "outer 1" "outer 2" a="outer a" b="outer b" c="outer c" e="outer e") as |outer|}}
          {{#with (component outer "inner 1" a="inner a" d="inner d" e="inner e") as |inner|}}
            {{#component inner "invocation 1" "invocation 2" a="invocation a" b="invocation b"}}---{{/component}}
          {{/with}}
        {{/with}}
      `
    );

    this.assertHTML(stripTight`
      <div id="ember*" class="ember-view">
        1. [outer 1]
        2. [outer 2]
        3. [inner 1]
        4. [invocation 1]
        5. [invocation 2]
        6. []

        ---

        a. [invocation a]
        b. [invocation b]
        c. [outer c]
        d. [inner d]
        e. [inner e]
        f. []
      </div>
    `);
  }

  @test
  'component helper: currying works inline'() {
    let { Class, instance } = inspecting(SixPositionalParamsComponent);

    this.registerComponent(
      'Curly',
      'foo-bar',
      stripTight`
        1. [{{this.one}}]
        2. [{{this.two}}]
        3. [{{this.three}}]
        4. [{{this.four}}]
        5. [{{this.five}}]
        6. [{{this.six}}]
      `,
      Class
    );

    this.render(
      stripTight`
        {{component (component (component 'foo-bar' this.foo.first this.foo.second) 'inner 1') 'invocation 1' 'invocation 2'}}
      `,
      {
        foo: {
          first: 'outer 1',
          second: 'outer 2',
        },
      }
    );

    this.assertHTML(stripTight`
      <div id="ember*" class="ember-view">
        1. [outer 1]
        2. [outer 2]
        3. [inner 1]
        4. [invocation 1]
        5. [invocation 2]
        6. []
      </div>
    `);
  }
}

class CurlyIdsTest extends CurlyTest {
  static suiteName = '[curly components] ids';

  @test
  'emberish curly component should have unique IDs'() {
    this.registerComponent('Curly', 'x-curly', '');

    this.render(
      stripTight`
        {{x-curly}}
        {{x-curly}}
        {{x-curly}}
      `
    );

    let [first, second, third] = this.guardArray(
      {
        nodes: [
          this.element.firstChild,
          this.element.firstChild?.nextSibling,
          this.element.firstChild?.nextSibling?.nextSibling,
        ],
      },
      {
        min: 3,
        condition: isSimpleElement,
      }
    );

    equalsElement(first, 'div', { id: regex(/^ember\d*$/u), class: 'ember-view' }, '');
    equalsElement(second, 'div', { id: regex(/^ember\d*$/u), class: 'ember-view' }, '');
    equalsElement(third, 'div', { id: regex(/^ember\d*$/u), class: 'ember-view' }, '');

    let IDs: Record<string, number> = {};

    function markAsSeen(element: SimpleElement | Element) {
      let id = unwrap(elementId(element));

      IDs[id] = (IDs[id] ?? 0) + 1;
    }

    let [firstChild, secondChild, thirdChild] = this.guardArray(
      {
        'child nodes': this.element.childNodes,
      },
      {
        min: 3,
        condition: isSimpleElement,
      }
    );

    markAsSeen(firstChild);
    markAsSeen(secondChild);
    markAsSeen(thirdChild);

    assert.strictEqual(
      Object.keys(IDs).length,
      3,
      'Expected the components to each have a unique IDs'
    );

    for (let id in IDs) {
      assert.strictEqual(IDs[id], 1, `Expected ID ${id} to be unique`);
    }
  }
}

class CurlyGlimmerComponentTest extends CurlyTest {
  static suiteName = '[curly components] glimmer components';

  @test
  'NonBlock without attributes replaced with a div'() {
    this.registerComponent('Glimmer', 'NonBlock', '<div ...attributes>In layout</div>');

    this.render('<NonBlock />');
    this.assertHTML('<div>In layout</div>');
    this.assertStableRerender();
  }

  @test
  'NonBlock with attributes replaced with a div'() {
    this.registerComponent(
      'Glimmer',
      'NonBlock',
      '<div such="{{@stability}}" ...attributes>In layout</div>'
    );

    this.render('<NonBlock @stability={{this.stability}} />', { stability: 'stability' });
    this.assertHTML('<div such="stability">In layout</div>');

    this.rerender({
      stability: 'changed!!!',
    });

    this.assertHTML('<div such="changed!!!">In layout</div>');
    this.assertStableNodes();
  }

  @test
  'NonBlock without attributes replaced with a web component'() {
    this.registerComponent(
      'Glimmer',
      'NonBlock',
      '<not-an-ember-component ...attributes>In layout</not-an-ember-component>'
    );

    this.render('<NonBlock />');

    this.assertHTML('<not-an-ember-component>In layout</not-an-ember-component>');
    this.assertStableRerender();
  }

  @test
  'NonBlock with attributes replaced with a web component'() {
    this.registerComponent(
      'Glimmer',
      'NonBlock',
      '<not-an-ember-component such="{{@stability}}" ...attributes>In layout</not-an-ember-component>'
    );

    this.render('<NonBlock @stability={{this.stability}} />', { stability: 'stability' });
    this.assertHTML('<not-an-ember-component such="stability">In layout</not-an-ember-component>');

    this.rerender({
      stability: 'changed!!!',
    });

    this.assertHTML('<not-an-ember-component such="changed!!!">In layout</not-an-ember-component>');
    this.assertStableNodes();
  }

  @test
  'Ensure components can be invoked'() {
    this.registerComponent('Glimmer', 'Outer', `<Inner></Inner>`);
    this.registerComponent('Glimmer', 'Inner', `<div ...attributes>hi!</div>`);

    this.render('<Outer />');
    this.assertHTML('<div>hi!</div>');
  }

  @test
  'Custom element with element modifier'() {
    this.registerModifier('foo', BoringModifier);

    this.render('<some-custom-element {{foo "foo"}}></some-custom-element>');
    this.assertHTML('<some-custom-element></some-custom-element>');
  }

  @test
  'Curly component hooks (with attrs)'() {
    let { Class, instance } = inspecting(NonBlock2);

    this.registerComponent('Curly', 'non-block', 'In layout - someProp: {{@someProp}}', Class);

    this.render('{{non-block someProp=this.someProp}}', { someProp: 'wycats' });

    instance.assert();

    assertFired(instance.value, 'didReceiveAttrs');
    assertFired(instance.value, 'willRender');
    assertFired(instance.value, 'didInsertElement');
    assertFired(instance.value, 'didRender');

    this.assertEmberishElement('div', 'In layout - someProp: wycats');

    this.rerender({ someProp: 'tomdale' });

    this.assertEmberishElement('div', 'In layout - someProp: tomdale');

    assertFired(instance.value, 'didReceiveAttrs', 2);
    assertFired(instance.value, 'willUpdate');
    assertFired(instance.value, 'willRender', 2);
    assertFired(instance.value, 'didUpdate');
    assertFired(instance.value, 'didRender', 2);

    this.rerender({ someProp: 'wycats' });

    this.assertEmberishElement('div', 'In layout - someProp: wycats');

    assertFired(instance.value, 'didReceiveAttrs', 3);
    assertFired(instance.value, 'willUpdate', 2);
    assertFired(instance.value, 'willRender', 3);
    assertFired(instance.value, 'didUpdate', 2);
    assertFired(instance.value, 'didRender', 3);
  }

  @test
  'Curly component hooks (attrs as self props)'() {
    let { instance, Class } = inspecting(NonBlock2);

    this.registerComponent('Curly', 'non-block', 'In layout - someProp: {{this.someProp}}', Class);

    this.render('{{non-block someProp=this.someProp}}', { someProp: 'wycats' });

    instance.assert();

    assertFired(instance.value, 'didReceiveAttrs');
    assertFired(instance.value, 'willRender');
    assertFired(instance.value, 'didInsertElement');
    assertFired(instance.value, 'didRender');

    this.assertEmberishElement('div', 'In layout - someProp: wycats');

    this.rerender({ someProp: 'tomdale' });

    this.assertEmberishElement('div', 'In layout - someProp: tomdale');

    assertFired(instance.value, 'didReceiveAttrs', 2);
    assertFired(instance.value, 'willUpdate');
    assertFired(instance.value, 'willRender', 2);
    assertFired(instance.value, 'didUpdate');
    assertFired(instance.value, 'didRender', 2);

    this.rerender({ someProp: 'wycats' });

    this.assertEmberishElement('div', 'In layout - someProp: wycats');

    assertFired(instance.value, 'didReceiveAttrs', 3);
    assertFired(instance.value, 'willUpdate', 2);
    assertFired(instance.value, 'willRender', 3);
    assertFired(instance.value, 'didUpdate', 2);
    assertFired(instance.value, 'didRender', 3);
  }

  @test
  'Setting value attributeBinding to null results in empty string value'() {
    let { instance, Class } = inspecting(InputComponent as EmberishCurlyComponentFactory);

    this.registerComponent('Curly', 'input-component', 'input component', Class);

    this.render('{{input-component value=this.someProp}}', { someProp: null });

    instance.assert();

    let element: HTMLInputElement = instance.value.element as HTMLInputElement;

    assert.strictEqual(element.value, '');

    this.rerender({
      someProp: 'wycats',
    });

    assert.strictEqual(element.value, 'wycats');

    this.rerender({
      someProp: null,
    });

    assert.strictEqual(element.value, '');
  }

  @test
  'Setting class attributeBinding does not clobber ember-view'() {
    let { instance, Class } = inspecting(AttributeBindingComponent);

    this.registerComponent('Curly', 'foo-bar', 'FOO BAR', Class);

    this.render('{{foo-bar class=this.classes}}', { classes: 'foo bar' });

    instance.assert();

    this.assertEmberishElement('div', { class: classes('ember-view foo bar') }, 'FOO BAR');

    this.rerender();

    this.assertEmberishElement('div', { class: classes('ember-view foo bar') }, 'FOO BAR');

    this.rerender({
      classes: 'foo bar baz',
    });

    this.assertEmberishElement('div', { class: classes('ember-view foo bar baz') }, 'FOO BAR');

    this.rerender({
      classes: 'foo bar',
    });

    this.assertEmberishElement('div', { class: classes('ember-view foo bar') }, 'FOO BAR');
  }

  @test
  'Curly component hooks (force recompute)'() {
    let { instance, Class } = NonBlock();

    this.registerComponent(
      'Curly',
      'non-block',
      'In layout - someProp: {{@someProp}}',
      inspectHooks(Class)
    );

    this.render('{{non-block someProp="wycats"}}');

    assert.ok(instance, 'instance is created');

    if (instance === undefined) {
      return;
    }

    assertFired(instance.value, 'didReceiveAttrs', 1);
    assertFired(instance.value, 'willRender', 1);
    assertFired(instance.value, 'didInsertElement', 1);
    assertFired(instance.value, 'didRender', 1);

    this.assertEmberishElement('div', 'In layout - someProp: wycats');

    this.rerender();

    this.assertEmberishElement('div', 'In layout - someProp: wycats');

    assertFired(instance.value, 'didReceiveAttrs', 1);
    assertFired(instance.value, 'willRender', 1);
    assertFired(instance.value, 'didRender', 1);

    instance.value.recompute();
    this.rerender();

    this.assertEmberishElement('div', 'In layout - someProp: wycats');

    assertFired(instance.value, 'didReceiveAttrs', 2);
    assertFired(instance.value, 'willUpdate', 1);
    assertFired(instance.value, 'willRender', 2);
    assertFired(instance.value, 'didUpdate', 1);
    assertFired(instance.value, 'didRender', 2);
  }

  @test
  'Can use named argument @component (e.g. `{{@component.name}}`) emberjs/ember.js#19313'() {
    this.registerComponent('Glimmer', 'Outer', '{{@component.name}}');

    this.render('<Outer @component={{hash name="Foo"}} />');
    this.assertHTML('Foo');

    this.rerender();

    this.assertHTML('Foo');
    this.assertStableNodes();
  }
}

class BoringModifier {}

class InputComponent extends EmberishCurlyComponent {
  override tagName = 'input';
  override attributeBindings = ['value'];
}

class AttributeBindingComponent extends EmberishCurlyComponent {
  override attributeBindings = ['class'];
}

class NonBlock2 extends EmberishCurlyComponent {}
class SimpleSubclass extends EmberishCurlyComponent {}

function NonBlock(): {
  instance: Capturing<EmberishCurlyComponent & HookedComponent>;
  Class: EmberishCurlyComponentFactory;
} {
  let instance = capturing<EmberishCurlyComponent>();

  class NonBlock extends EmberishCurlyComponent {
    override init() {
      instance.capture(this);
    }
  }

  return {
    instance: instance as Capturing<EmberishCurlyComponent & HookedComponent>,
    Class: NonBlock as EmberishCurlyComponentFactory,
  };
}

class CurlyTeardownTest extends CurlyTest {
  static suiteName = '[curly components] teardown';

  @test
  'curly components are destroyed'() {
    let components = CurlyDestroyList();
    this.registerComponent('Curly', 'destroy-me', 'destroy me!', components.Component1);

    this.render(`{{#if this.cond}}{{destroy-me}}{{/if}}`, { cond: true });

    components.verify([]);

    this.rerender({ cond: false });

    components.verify(['willDestroy: Component1', 'destroy: Component1']);
  }

  @test
  'glimmer components are destroyed'() {
    let components = GlimmerDestroyList();

    this.registerComponent(
      'Glimmer',
      'DestroyMe',
      '<div ...attributes>destroy me!</div>',
      components.Component1
    );

    this.render(`{{#if this.cond}}<DestroyMe />{{/if}}`, { cond: true });

    components.verify([]);

    this.rerender({ cond: false });

    components.verify(['Component1']);
  }

  @test
  'component helpers component are destroyed'() {
    let components = CurlyDestroyList();

    this.registerComponent('Curly', 'destroy-me', 'destroy me!', components.Component1);

    this.registerComponent('Curly', 'another-component', 'another thing!', components.Component2);

    this.render(`{{component this.componentName}}`, { componentName: 'destroy-me' });

    components.verify([]);

    this.rerender({ componentName: 'another-component' });

    components.verify(['willDestroy: Component1', 'destroy: Component1']);
  }

  @test
  'components inside a list are destroyed'() {
    let components = CurlyDestroyList();

    this.registerComponent('Curly', 'DestroyMe', '<div>destroy me!</div>', components.Component1);

    this.render(`{{#each this.list as |item|}}<DestroyMe @item={{item}} />{{/each}}`, {
      list: [1, 2, 3, 4, 5],
    });

    components.verify([]);

    this.rerender({ list: [1, 2, 3] });

    components.verify([
      'willDestroy: Component1: 4',
      'willDestroy: Component1: 5',
      'destroy: Component1: 4',
      'destroy: Component1: 5',
    ]);

    this.rerender({ list: [3, 2, 1] });

    components.verify([]);

    this.rerender({ list: [] });

    components.verify([
      'willDestroy: Component1: 1',
      'willDestroy: Component1: 2',
      'willDestroy: Component1: 3',
      'destroy: Component1: 1',
      'destroy: Component1: 2',
      'destroy: Component1: 3',
    ]);
  }

  @test
  'components inside a list are destroyed (when key is @identity)'() {
    let components = CurlyDestroyList();

    this.registerComponent('Curly', 'DestroyMe', '<div>destroy me!</div>', components.Component1);

    let value1 = { val: 1 };
    let value2 = { val: 2 };
    let value3 = { val: 3 };
    let value4 = { val: 4 };
    let value5 = { val: 5 };

    this.render(
      `{{#each this.list key='@identity' as |item|}}<DestroyMe @item={{item.val}} />{{/each}}`,
      {
        list: [value1, value2, value3, value4, value5],
      }
    );

    components.verify([]);

    this.rerender({ list: [value1, value2, value3] });

    components.verify([
      'willDestroy: Component1: 4',
      'willDestroy: Component1: 5',
      'destroy: Component1: 4',
      'destroy: Component1: 5',
    ]);

    this.rerender({ list: [value3, value2, value1] });

    components.verify([]);

    this.rerender({ list: [] });

    components.verify([
      'willDestroy: Component1: 1',
      'willDestroy: Component1: 2',
      'willDestroy: Component1: 3',
      'destroy: Component1: 1',
      'destroy: Component1: 2',
      'destroy: Component1: 3',
    ]);
  }

  @test.todo
  'components that are "destroyed twice" are destroyed once'() {
    let components = CurlyDestroyList();

    this.registerComponent(
      'Curly',
      'destroy-me',
      '{{#if @cond}}{{destroy-me-inner from="inner" item="single"}}{{/if}}',
      components.Component1
    );
    this.registerComponent('Curly', 'destroy-me-inner', 'inner', components.Component2);

    this.render(
      `{{#if this.cond}}{{destroy-me from="root" item="single" cond=this.child.cond}}{{/if}}`,
      {
        cond: true,
        child: { cond: true },
      }
    );

    components.verify([]);

    this.rerender({ cond: false, child: { cond: false } });

    components.verify(['destroy-me1: single', 'destroy-me2: inner - single']);
  }

  @test.todo
  'deeply nested destructions'() {
    let components = CurlyDestroyList();

    this.registerComponent(
      'Curly',
      'DestroyMe1',
      '<div>{{#destroy-me2 item=@item from="destroy-me1"}}{{yield}}{{/destroy-me2}}</div>',
      components.Component1
    );
    this.registerComponent('Curly', 'destroy-me2', 'Destroy me! {{yield}}', components.Component2);

    this.render(
      `{{#each this.list key='@identity' as |item|}}<DestroyMe1 @item={{item}}>{{#destroy-me2 from="root" item=item}}{{/destroy-me2}}</DestroyMe1>{{/each}}`,
      { list: [1, 2, 3, 4, 5] }
    );

    components.verify([]);

    this.rerender({ list: [1, 2, 3] });

    components.verify([
      'destroy-me1: 4',
      'destroy-me2: destroy-me1 - 4',
      'destroy-me2: root - 4',
      'destroy-me1: 5',
      'destroy-me2: destroy-me1 - 5',
      'destroy-me2: root - 5',
    ]);

    this.rerender({ list: [3, 2, 1] });

    components.verify([]);

    this.rerender({ list: [] });

    components.verify([
      'destroy-me1: 1',
      'destroy-me2: destroy-me1 - 1',
      'destroy-me2: root - 1',
      'destroy-me1: 2',
      'destroy-me2: destroy-me1 - 2',
      'destroy-me2: root - 2',
      'destroy-me1: 3',
      'destroy-me2: destroy-me1 - 3',
      'destroy-me2: root - 3',
    ]);
  }

  @test
  'components inside the root are destroyed when the render result is destroyed'(assert: Assert) {
    let components = DestroyComponents();

    this.registerComponent(
      'Glimmer',
      'DestroyMe1',
      '<div>Destry me!</div>',
      components.DestroyGlimmer
    );
    this.registerComponent('Curly', 'destroy-me2', 'Destroy me too!', components.DestroyEmberish);

    this.render(`<DestroyMe1 id="destroy-me1"/>{{destroy-me2 id="destroy-me2"}}`);

    assert.strictEqual(
      components.glimmerDestroyed,
      false,
      'the glimmer component should not be destroyed'
    );
    assert.strictEqual(
      components.emberishDestroyed,
      false,
      'the curly component should not be destroyed'
    );

    this.destroy();

    assert.strictEqual(
      components.glimmerDestroyed,
      true,
      'the glimmer component destroy hook was called'
    );
    assert.strictEqual(
      components.emberishDestroyed,
      true,
      'the glimmer component destroy hook was called'
    );

    assert.strictEqual(
      document.querySelectorAll('#destroy-me1').length,
      0,
      'component DOM node was removed from DOM'
    );
    assert.strictEqual(
      document.querySelectorAll('#destroy-me2').length,
      0,
      'component DOM node was removed from DOM'
    );

    assert.strictEqual(
      document.querySelector('#qunit-fixture')!.childElementCount,
      0,
      'root view was removed from DOM'
    );

    assert.verifyActions(['[glimmerish] willDestroy']);
  }

  @test
  'tagless components render properly'() {
    this.registerComponent('TemplateOnly', 'foo-bar', `Michael Jordan says "Go Tagless"`);

    this.render(`{{foo-bar}}`);
    this.assertHTML('Michael Jordan says "Go Tagless"');
    this.assertStableRerender();
  }
}

function GlimmerDestroyList() {
  let destroyed: string[] = [];
  abstract class DestroyMeComponent extends GlimmerishComponent {
    protected abstract testName: string;

    constructor(owner: Owner, args: Dict) {
      super(owner, args);

      registerDestructor(this, () => {
        let parts = [this.testName];

        if (args['item'] !== undefined) {
          parts.push(String(args['item']));
        }

        if (args['from'] !== undefined) {
          parts.push(String(args['from']));
        }

        destroyed.push(parts.join(': '));
      });
    }

    protected get testDescription() {
      let parts = [this.testName];

      if (this.args['item'] !== undefined) {
        parts.push(String(this.args['item']));
      }

      if (this.args['from'] !== undefined) {
        parts.push(String(this.args['from']));
      }

      return parts.join(': ');
    }
  }

  class Component1 extends DestroyMeComponent {
    protected testName = 'Component1';
  }

  class Component2 extends DestroyMeComponent {
    protected testName = 'Component2';
  }

  return {
    Component1: Component1 as typeof GlimmerishComponent,
    Component2: Component2 as typeof GlimmerishComponent,
    verify(expected: (string | number)[]) {
      QUnit.assert.deepEqual(destroyed, expected, 'destroy should be called');
      destroyed = [];
    },
  };
}

function CurlyDestroyList() {
  let destroyed: string[] = [];

  abstract class DestroyMeComponent extends EmberishCurlyComponent {
    protected abstract testName: string;

    protected get testDescription() {
      let parts = [this.testName];

      if (this.attrs['item'] !== undefined) {
        parts.push(String(this.attrs['item']));
      }

      if (this.attrs['from'] !== undefined) {
        parts.push(String(this.attrs['from']));
      }

      return parts.join(': ');
    }
  }

  class Component1 extends DestroyMeComponent {
    readonly testName = 'Component1';

    override willDestroyElement() {
      super.willDestroyElement();
      destroyed.push(`willDestroy: ${this.testDescription}`);
    }

    override destroy() {
      super.destroy();
      destroyed.push(`destroy: ${this.testDescription}`);
    }
  }

  class Component2 extends DestroyMeComponent {
    readonly testName = 'Component2';

    override willDestroyElement() {
      super.willDestroyElement();
      destroyed.push(`willDestroy: ${this.testDescription}`);
    }

    override destroy() {
      super.destroy();
      destroyed.push(`destroy: ${this.testDescription}`);
    }
  }

  return {
    Component1: Component1,
    Component2: Component2,
    verify(expected: (string | number)[]) {
      QUnit.assert.deepEqual(destroyed, expected, 'destroy should be called');
      destroyed = [];
    },
  };
}

export function DestroyComponents() {
  let glimmerDestroyed = false;
  let curlyDestroyed = false;

  class DestroyMe1Component extends GlimmerishComponent {
    override willDestroy(this: GlimmerishComponent) {
      super.willDestroy();
      QUnit.assert.action('[glimmerish] willDestroy');
      glimmerDestroyed = true;
    }
  }

  class DestroyMe2Component extends EmberishCurlyComponent {
    override destroy(this: EmberishCurlyComponent) {
      super.destroy();
      curlyDestroyed = true;
    }
  }

  return {
    get glimmerDestroyed() {
      return glimmerDestroyed;
    },
    get emberishDestroyed() {
      return curlyDestroyed;
    },
    DestroyGlimmer: DestroyMe1Component,
    DestroyEmberish: DestroyMe2Component,
  };
}

class LateBoundLayout extends EmberishCurlyComponent {
  override layout = createTemplate('Swap - {{yield}}')();
}

class CurlyLateLayoutTest extends CurlyTest {
  static suiteName = '[curly component] late bound layout';

  declare delegate: JitRenderDelegate;

  @test
  'can bind the layout late'() {
    this.delegate.registerComponent('Curly', 'Curly', 'foo-bar', null, LateBoundLayout);

    this.render('{{#foo-bar}}YIELD{{/foo-bar}}');

    equalsElement(
      this.element.firstChild,

      'div',
      {
        class: classes('ember-view'),
        id: regex(/^ember\d*$/u),
      },
      'Swap - YIELD'
    );
  }
}

class CurlyAppendableTest extends CurlyTest {
  static suiteName = '[curly component] appendable components';

  declare delegate: JitRenderDelegate;

  @test
  'it does not work on optimized appends'() {
    this.registerComponent('Curly', 'foo-bar', 'foo bar');

    let definition = this.delegate.createCurriedComponent('foo-bar');

    this.render('{{this.foo}}', { foo: definition });
    this.assertEmberishElement('div', {}, 'foo bar');
    this.assertStableRerender();

    this.rerender({ foo: 'foo' });
    this.assertHTML('foo');

    this.rerender({ foo: definition });
    this.assertEmberishElement('div', {}, 'foo bar');
  }

  @test
  'it works on unoptimized appends (dot paths)'() {
    this.registerComponent('Curly', 'foo-bar', 'foo bar');

    let definition = this.delegate.createCurriedComponent('foo-bar');

    this.render('{{this.foo.bar}}', { foo: { bar: definition } });
    this.assertEmberishElement('div', {}, 'foo bar');
    this.assertStableRerender();

    this.rerender({ foo: { bar: 'lol' } });
    this.assertHTML('lol');
    this.assertStableRerender();

    this.rerender({ foo: { bar: 'omg' } });
    this.assertHTML('omg');

    this.rerender({ foo: { bar: definition } });
    this.assertEmberishElement('div', {}, 'foo bar');
  }

  @test
  'it works on unoptimized appends (this paths)'() {
    this.registerComponent('Curly', 'foo-bar', 'foo bar');

    let definition = this.delegate.createCurriedComponent('foo-bar');

    this.render('{{this.foo}}', { foo: definition });
    this.assertEmberishElement('div', {}, 'foo bar');
    this.assertStableRerender();

    this.rerender({ foo: 'lol' });
    this.assertHTML('lol');
    this.assertStableRerender();

    this.rerender({ foo: 'omg' });
    this.assertHTML('omg');

    this.rerender({ foo: definition });
    this.assertEmberishElement('div', {}, 'foo bar');
  }

  @test
  'it works on unoptimized appends when initially not a component (dot paths)'() {
    this.registerComponent('Curly', 'foo-bar', 'foo bar');

    let definition = this.delegate.createCurriedComponent('foo-bar');

    this.render('{{this.foo.bar}}', { foo: { bar: 'lol' } });
    this.assertHTML('lol');
    this.assertStableRerender();

    this.rerender({ foo: { bar: definition } });
    this.assertEmberishElement('div', {}, 'foo bar');
    this.assertStableRerender();

    this.rerender({ foo: { bar: 'lol' } });
    this.assertHTML('lol');
  }

  @test
  'it works on unoptimized appends when initially not a component (this paths)'() {
    this.registerComponent('Curly', 'foo-bar', 'foo bar');

    let definition = this.delegate.createCurriedComponent('foo-bar');

    this.render('{{this.foo}}', { foo: 'lol' });
    this.assertHTML('lol');
    this.assertStableRerender();

    this.rerender({ foo: definition });
    this.assertEmberishElement('div', {}, 'foo bar');
    this.assertStableRerender();

    this.rerender({ foo: 'lol' });
    this.assertHTML('lol');
  }
}

class NormalComponent extends GlimmerishComponent {
  public name = 'Julia';
  public conference = 'EmberConf';
}

// demonstrates ability for Ember to know the target object of curly component actions
class GrandparentTagless extends EmberishCurlyComponent {
  public override tagName = '';
}

class ParentTagless extends GrandparentTagless {
  public override name = 'foo-bar';
}

class ChildTagless extends ParentTagless {
  public override name = 'qux-derp';
}

class SixPositionalParamsComponent extends EmberishCurlyComponent {
  static override positionalParams = ['one', 'two', 'three', 'four', 'five', 'six'];
}

function OnePositionalParamComponent() {
  return class OnePositionalParamComponent extends EmberishCurlyComponent {
    static override positionalParams = 'names';
  };
}

function TwoPositionalParamsComponent() {
  return class TwoPositionalParamsComponent extends EmberishCurlyComponent {
    static override positionalParams = ['first', 'second'];
  };
}

class CurlyBoundsTrackingTest extends CurlyTest {
  static suiteName = '[curly components] bounds tracking';

  @test
  'it works for wrapped (curly) components'() {
    let { instance, Class } = inspecting(ElementComponent('span'));

    this.registerComponent('Curly', 'foo-bar', 'foo bar', Class);

    this.render('zomg {{foo-bar}} wow');

    assert.ok(instance, 'instance is created');

    if (!instance) {
      return;
    }

    this.assertEmberishElement('span', {}, 'foo bar');

    let { bounds, element } = instance.value;

    assert.strictEqual(
      bounds.parentElement(),
      document.querySelector('#qunit-fixture') as unknown as SimpleElement
    );
    assert.strictEqual(bounds.firstNode(), castToSimple(element));
    assert.strictEqual(bounds.lastNode(), castToSimple(element));
  }

  @test
  'it works for tagless components'() {
    let { Class, instance } = inspecting(TaglessComponent);

    this.registerComponent(
      'Curly',
      'foo-bar',
      '<span id="first-node">foo</span> <span id="before-last-node">bar</span>!',
      Class
    );

    this.render('zomg {{foo-bar}} wow');

    this.assertHTML(
      'zomg <span id="first-node">foo</span> <span id="before-last-node">bar</span>! wow'
    );

    let { bounds } = instance.value;

    assert.strictEqual(
      check(bounds.parentElement(), HTMLElement),
      check(document.querySelector('#qunit-fixture'), HTMLElement)
    );
    assert.strictEqual(
      check(bounds.firstNode(), HTMLElement),
      check(document.querySelector('#first-node'), HTMLElement)
    );
    assert.strictEqual(
      check(bounds.lastNode(), Node),
      document.querySelector('#before-last-node')!.nextSibling
    );
  }

  @test
  'A curly component can have an else block'() {
    this.registerComponent('Curly', 'render-else', `{{yield to="inverse"}}`);

    this.render('{{#render-else}}Nope{{else}}<div id="test">123</div>{{/render-else}}');
    this.assertHTML('<div id="ember1" class="ember-view"><div id="test">123</div></div>');
    this.assertStableRerender();
  }
}

jitSuite(CurlyCreateTest);
jitSuite(CurlyDynamicComponentTest);
jitSuite(CurlyDynamicCustomizationTest);
jitSuite(CurlyArgsTest);
jitSuite(CurlyScopeTest);
jitSuite(CurlyDynamicScopeSmokeTest);
jitSuite(CurlyPositionalArgsTest);
jitSuite(CurlyClosureComponentsTest);
jitSuite(CurlyIdsTest);
jitSuite(CurlyGlimmerComponentTest);
jitSuite(CurlyTeardownTest);
jitSuite(CurlyLateLayoutTest);
jitSuite(CurlyAppendableTest);
jitSuite(CurlyBoundsTrackingTest);

function check<T>(node: Node | SimpleNode | null, Type: { new (...args: any[]): T }): T {
  if (node instanceof Type) {
    return node;
  } else {
    throw new TypeError(`Expected ${Type.name} but got ${node?.constructor.name ?? 'null'}`);
  }
}
