import { NodeRenderTest } from '../modes/node/env';
import { render } from '../test-decorator';

export class ServerSideSuite extends NodeRenderTest {
  static suiteName = 'Server Side Rendering';

  @render
  'HTML text content'() {
    this.render.template('content');
    this.assertHTML('content');
  }

  @render
  'HTML tags'() {
    this.render.template('<h1>hello!</h1><div>content</div>');
    this.assertHTML('<h1>hello!</h1><div>content</div>');
  }

  @render
  'HTML tags re-rendered'() {
    this.render.template('<h1>hello!</h1><div>content</div>');
    this.assertHTML('<h1>hello!</h1><div>content</div>');
    this.rerender();
    this.assertHTML('<h1>hello!</h1><div>content</div>');
  }

  @render
  'HTML attributes'() {
    this.render.template("<div id='bar' class='foo'>content</div>");
    this.assertHTML('<div id="bar" class="foo">content</div>');
  }

  @render
  'HTML tag with empty attribute'() {
    this.render.template("<div class=''>content</div>");
    this.assertHTML('<div class>content</div>');
  }

  @render
  "HTML boolean attribute 'disabled'"() {
    this.render.template('<input disabled>');
    this.assertHTML('<input disabled>');
  }

  @render
  'Quoted attribute expression is removed when null'() {
    this.render.template('<input disabled="{{this.isDisabled}}">', { isDisabled: null });
    this.assertHTML('<input>');
  }

  @render
  'Unquoted attribute expression with null value is not coerced'() {
    this.render.template('<input disabled={{this.isDisabled}}>', { isDisabled: null });
    this.assertHTML('<input>');
  }

  @render
  'Attribute expression can be followed by another attribute'() {
    this.render.template('<div foo="{{this.funstuff}}" name="Alice"></div>', { funstuff: 'oh my' });
    this.assertHTML('<div foo="oh my" name="Alice"></div>');
  }

  @render
  'HTML tag with data- attribute'() {
    this.render.template("<div data-some-data='foo'>content</div>");
    this.assertHTML('<div data-some-data="foo">content</div>');
  }

  @render
  'The compiler can handle nesting'() {
    this.render.template(
      '<div class="foo"><p><span id="bar" data-foo="bar">hi!</span></p></div>&nbsp;More content'
    );

    // Note that the space after the closing div tag is a non-breaking space (Unicode 0xA0)
    this.assertHTML(
      '<div class="foo"><p><span id="bar" data-foo="bar">hi!</span></p></div> More content'
    );
  }

  @render
  'The compiler can handle comments'() {
    this.render.template('<div><!-- Just passing through --></div>');
    this.assertHTML('<div><!-- Just passing through --></div>');
  }

  @render
  'The compiler can handle HTML comments with mustaches in them'() {
    this.render.template('<div><!-- {{foo}} --></div>', { foo: 'bar' });
    this.assertHTML('<div><!-- {{foo}} --></div>');
  }

  @render
  'The compiler can handle HTML comments with complex mustaches in them'() {
    this.render.template('<div><!-- {{foo bar baz}} --></div>', { foo: 'bar' });
    this.assertHTML('<div><!-- {{foo bar baz}} --></div>');
  }

  @render
  'The compiler can handle HTML comments with multi-line mustaches in them'() {
    this.render.template('<div><!-- {{#each foo as |bar|}}\n{{bar}}\n\n{{/each}} --></div>', {
      foo: 'bar',
    });

    this.assertHTML('<div><!-- {{#each foo as |bar|}}\n{{bar}}\n\n{{/each}} --></div>');
  }

  @render
  'The compiler can handle comments with no parent element'() {
    this.render.template('<!-- {{foo}} -->', { foo: 'bar' });
    this.assertHTML('<!-- {{foo}} -->');
  }

  @render
  'The compiler can handle simple handlebars'() {
    this.render.template('<div>{{this.title}}</div>', { title: 'hello' });
    this.assertHTML('<div>hello</div>');
  }

  @render
  'The compiler can handle escaping HTML'() {
    this.render.template('<div>{{this.title}}</div>', { title: '<strong>hello</strong>' });
    this.assertHTML('<div>&lt;strong&gt;hello&lt;/strong&gt;</div>');
  }

  @render
  'The compiler can handle unescaped HTML'() {
    this.render.template('<div>{{{this.title}}}</div>', { title: '<strong>hello</strong>' });
    this.assertHTML('<div><strong>hello</strong></div>');
  }

  @render
  'Unescaped helpers render correctly'() {
    this.register.helper('testing-unescaped', (params) => params[0]);
    this.render.template('{{{testing-unescaped "<span>hi</span>"}}}');
    this.assertHTML('<span>hi</span>');
  }

  @render
  'Null literals do not have representation in DOM'() {
    this.render.template('{{null}}');
    this.assertHTML('');
  }

  @render
  'Attributes can be populated with helpers that generate a string'() {
    this.register.helper('testing', (params) => {
      return params[0];
    });

    this.render.template('<a href="{{testing this.url}}">linky</a>', { url: 'linky.html' });
    this.assertHTML('<a href="linky.html">linky</a>');
  }

  @render
  'Elements inside a yielded block'() {
    this.render.template('{{#if true}}<div id="test">123</div>{{/if}}');
    this.assertHTML('<div id="test">123</div>');
  }

  @render
  'A simple block helper can return text'() {
    this.render.template('{{#if true}}test{{else}}not shown{{/if}}');
    this.assertHTML('test');
  }

  @render
  'SVG: basic element'() {
    let template = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="10" height="100" width="100" style="stroke:#ff0000; fill: #0000ff"></rect>
      </svg>
    `;
    this.render.template(template);
    this.assertHTML(template);
  }

  @render
  'SVG: element with xlink:href'() {
    let template = `
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <rect x=".01" y=".01" width="4.98" height="2.98" fill="none" stroke="blue" stroke-width=".03"></rect>
        <a xlink:href="http://www.w3.org">
          <ellipse cx="2.5" cy="1.5" rx="2" ry="1" fill="red"></ellipse>
        </a>
      </svg>
    `;
    this.render.template(template);

    this.assertHTML(template);
  }
}

export class ServerSideComponentSuite extends NodeRenderTest {
  static suiteName = 'Server Side Components';

  @render
  'can render components'() {
    this.render.template({
      layout: '<h1>Hello World!</h1>',
    });
    this.assertComponent('<h1>Hello World!</h1>');
  }

  @render
  'can render components with yield'() {
    this.render.template({
      layout: '<h1>Hello {{yield}}!</h1>',
      template: 'World',
    });
    this.assertComponent('<h1>Hello World!</h1>');
  }

  @render
  'can render components with args'() {
    this.render.template(
      {
        layout: '<h1>Hello {{@place}}!</h1>',
        template: 'World',
        args: { place: 'this.place' },
      },
      { place: 'World' }
    );
    this.assertComponent('<h1>Hello World!</h1>');
  }

  @render
  'can render components with block params'() {
    this.render.template(
      {
        layout: '<h1>Hello {{yield @place}}!</h1>',
        template: '{{place}}',
        args: { place: 'this.place' },
        blockParams: ['place'],
      },
      { place: 'World' }
    );
    this.assertComponent('<h1>Hello World!</h1>');
  }
}
