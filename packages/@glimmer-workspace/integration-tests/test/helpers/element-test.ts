/**
 * TODO:
 *   copy from: https://github.com/tildeio/ember-element-helper/blob/main/test-app/tests/integration/helpers/element-test.js
 *   add:
 *     - ensure that `element` can be shadowed
 *       - ensure that user-land `element` used instead of `element` (someone else may have their own implementation)
 *
 *   then,
 *      - message chancancode about implementation
 */
import { jitSuite, RenderTest, strip, test } from '@glimmer-workspace/integration-tests';

class ElementTest extends RenderTest {
  static suiteName = 'Helpers test: {{element}}';

  @test
  'renders a tag with the given tag name'() {
    this.render(strip`
      {{#let (element "h1") as |Tag|}}
        <Tag id="content">hello world!</Tag>
      {{/let}}
    `);

    this.assertHTML('<h1 id="content">hello world!</h1>');

    this.assertStableRerender();
  }

  @test
  'it does not render any tags when passed an empty string'() {
    this.render(strip`
      {{#let (element "") as |Tag|}}
        <Tag id="content">hello world!</Tag>
      {{/let}}
    `);

    this.assertHTML('hello world!');

    this.assertStableRerender();
  }

  @test
  'it does not render anything when passed null'() {
    this.render(strip`
      {{#let (element null) as |Tag|}}
        <Tag id="content">hello world!</Tag>
      {{/let}}
    `);

    this.assertHTML('<!---->');

    this.assertStableRerender();
  }

  @test
  'it does not render anything when passed undefined'() {
    this.render(strip`
      {{#let (element undefined) as |Tag|}}
        <Tag id="content">hello world!</Tag>
      {{/let}}
    `);

    this.assertHTML('<!---->');

    this.assertStableRerender();
  }

  @test
  'it works with element modifiers'() {
    let clicked = 0;

    this.render(
      strip`
      {{#let (element "button") as |Tag|}}\
        <Tag type="button" id="action" {{on "click" this.didClick}}>hello world!</Tag>\
      {{/let}}\
    `,
      { didClick: () => clicked++ }
    );

    this.assertHTML('');

    let button = this.find('button');
    this.assert.strictEqual(button.getAttribute('type'), 'button');
    this.assert.strictEqual(button.textContent?.trim(), 'hello world!');
    this.assert.strictEqual(clicked, 0, 'never clicked');

    button.click();
    this.assert.strictEqual(clicked, 1, 'clicked once');

    button.click();
    this.assert.strictEqual(clicked, 2, 'clicked twice');

    this.assertStableRerender();
  }

  @test
  'it can be rendered multiple times'() {
    this.render(strip`
      {{#let (element "h1") as |Tag|}}\
        <Tag id="content-1">hello</Tag>\
        <Tag id="content-2">world</Tag>\
        <Tag id="content-3">!!!!!</Tag>\
      {{/let}}\
    `);

    this.assertHTML('');

    this.assert.strictEqual(this.text('h1#content-1'), 'hello');
    this.assert.strictEqual(this.text('h1#content-2'), 'world');
    this.assert.strictEqual(this.text('h1#content-3'), '!!!!!');

    this.assertStableRerender();
  }

    @test
    'it can be passed to the component helper'() {
      this.render(strip`
       {{#let (component (element "h1")) as |Tag|}}
          <Tag id="content-1">hello</Tag>
        {{/let}}

        {{#let (element "h2") as |Tag|}}
          <Tag id="content-2">world</Tag>
        {{/let}}

        {{#let (element "h3") as |h3|}}
          {{#component h3 id="content-3"}}!!!!!{{/component}}
        {{/let}}
      `);

      this.assertHTML('');

      this.assert.strictEqual(this.text('h1#content-1'), 'hello');
      this.assert.strictEqual(this.text('h2#content-2'), 'world');
      this.assert.strictEqual(this.text('h3#content-3'), '!!!!!');

      this.assertStableRerender();
    }

    @test
    'it renders when the tag name changes'() {
      
      this.render(strip`
        {{#let (element this.tagName) as |Tag|}}
          <Tag id="content">rendered {{counter}} time(s)</Tag>
        {{/let}}
      `, { tagName: 'h1' });

      this.assertHTML('');
      this.assert.strictEqual(this.text('h1'), 'rendered 1 time(s)');
      this.assert.strictEqual(this.text('h2'), '');
      this.assert.strictEqual(this.text('h3'), '');

      this.rerender({ tagName: 'h2' });
      this.assert.strictEqual(this.text('h1'), '');
      this.assert.strictEqual(this.text('h2'), 'rendered 2 time(s)');
      this.assert.strictEqual(this.text('h3'), '');

      this.rerender({ tagName: 'h3' });
      this.assert.strictEqual(this.text('h1'), '');
      this.assert.strictEqual(this.text('h2'), 'rendered 2 time(s)');
      this.assert.strictEqual(this.text('h3'), '');

      this.rerender({ tagName: 'h3' });
      this.assert.strictEqual(this.text('h1'), '');
      this.assert.strictEqual(this.text('h2'), '');
      this.assert.strictEqual(this.text('h3'), 'rendered 3 time(s)');

      this.rerender({ tagName: '' });
      this.assert.strictEqual(this.text('h1'), '');
      this.assert.strictEqual(this.text('h2'), '');
      this.assert.strictEqual(this.text('h3'), '');
      this.assert.strictEqual(this.text(), 'rendered 4 time(s)');

      this.rerender({ tagName: 'h1' });
      this.assert.strictEqual(this.text('h1'), 'rendered 5 time(s)');
      this.assert.strictEqual(this.text('h2#ntent'), '');
      this.assert.strictEqual(this.text('h3'), '');

      this.assertStableRerender();
    }

    @test
    'it can be passed as argument and works with ...attributes'() {
      this.render(strip`
        <ElementReceiver @tag={{element this.tagName}} class="extra">Test</ElementReceiver>
      `, { tagName: 'p' });

      this.assertHTML('');
      this.assert.strictEqual(this.text('p#content'), 'Test');
      this.assert.ok(this.find('p#content').classList.contains('extra'));

      this.rerender({ tagName: 'div' });
      this.assert.strictEqual(this.text('div#content'), 'Test');
      this.assert.ok(this.find('div#content').classList.contains('extra'));

      this.rerender({ tagName: '' });
      this.assert.strictEqual(this.text(), 'Test');

      this.rerender({ tagName: 'p' });
      this.assert.strictEqual(this.text('p#content'), 'Test');
      this.assert.ok(this.find('p#content').classList.contains('extra'));

      this.assertStableRerender();
    }

    @test
    'it can be invoked inline'() {
      this.render(strip`
        {{element this.tagName}}
      `, { tagName: 'p' });

      this.assertHTML('');
      this.assert.strictEqual(this.text('p'), '');

      this.rerender({ tagName: 'br' });
      this.assert.strictEqual(this.text('br'), '');

      this.rerender({ tagName: '' });
      this.assert.strictEqual(this.text(), '');

      this.rerender({ tagName: 'p' });
      this.assert.strictEqual(this.text('p'), '');

      this.assertStableRerender();
    }

    @test
    'invalid usage: it requires at least one argument'() {
      this.render(``);
      this.assertHTML('');
      // TODO: Assert that a rendering error occurs
      //  expectEmberError(
      //         new Error(
      //           'Assertion Failed: The `element` helper takes a single positional argument'
      //         )
      //       );

      this.render(strip`
        <div>
          {{#let (element) as |Tag|}}
            <Tag id="content">hello world!</Tag>
          {{/let}}
        </div>
      `);

      this.assertHTML('');
      this.assertStableRerender();
    }

    @test
    'invalid usage: it requires no more than one argument'() {
      this.render(``);
      this.assertHTML('');
      // TODO: Assert that a rendering error occurs
      // expectEmberError(
      //   new Error(
      //     'Assertion Failed: The `element` helper takes a single positional argument'
      //   )
      // );

      this.render(strip`
        <div>
          {{#let (element "h1" "h2") as |Tag|}}
            <Tag id="content">hello world!</Tag>
          {{/let}}
        </div>
      `);

      this.assertStableRerender();
    }

    @test
    'invalid usage: it does not take any named arguments'() {
      this.render(``);
      this.assertHTML('');
      // TODO: Assert that a rendering error occurs
      // expectEmberError(
      //   new Error(
      //     'Assertion Failed: The `element` helper does not take any named arguments'
      //   )
      // );

      this.render(strip`
        <div>
          {{#let (element "h1" foo="bar") as |Tag|}}
            <Tag id="content">hello world!</Tag>
          {{/let}}
        </div>
      `);

      this.assertStableRerender();
    }

    @test
    'invalid usage: it does not take a block'() {
      this.render(``);
      this.assertHTML('');
      // TODO: Assert that a rendering error occurs
      // expectEmberError(
      //   new Error(
      //     'Assertion Failed: The `element` helper does not take a block'
      //   )
      // );

      this.render(strip`
        <div>
          {{#element "h1" as |Tag|}}
            <Tag id="content">hello world!</Tag>
          {{/element}}
        </div>
      `);

      this.assertStableRerender();
    }

    @test
    'invalid usage: it throws when passed a number'() {
      this.render(``);
      this.assertHTML('');
      // TODO: Assert that a rendering error occurs
      // expectEmberError(
      //   new Error(
      //     'Assertion Failed: The argument passed to the `element` helper must be a string'
      //   )
      // );

      this.render(strip`
        <div>
          {{#let (element 123) as |Tag|}}
            <Tag id="content">hello world!</Tag>
          {{/let}}
        </div>
      `);

      this.assertStableRerender();
    }

    @test
    'invalid usage: it throws when passed a boolean'() {
      this.render(``);
      this.assertHTML('');
      // TODO: Assert that a rendering error occurs
      // expectEmberError(
      //   new Error(
      //     'Assertion Failed: The argument passed to the `element` helper must be a string'
      //   )
      // );

      this.render(strip`
        <div>
          {{#let (element true) as |Tag|}}
            <Tag id="content">hello world!</Tag>
          {{/let}}
        </div>
      `);

      this.assertStableRerender();
    }

    @test
    'invalid usage: it throws when passed an object'() {
      this.render(``);
      this.assertHTML('');
      // TODO: Assert that a rendering error occurs
      // expectEmberError(
      //   new Error(
      //     'Assertion Failed: The argument passed to the `element` helper must be a string'
      //   )
      // );

      this.render(strip`
        <div>
          {{#let (element (hash)) as |Tag|}}
            <Tag id="content">hello world!</Tag>
          {{/let}}
        </div>
      `);

      this.assertStableRerender();
    }
}

jitSuite(ElementTest);
