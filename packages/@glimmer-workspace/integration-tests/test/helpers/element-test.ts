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
import { GlimmerishComponent, jitSuite, RenderTest, strip, test, tracked } from '../..';

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

    this.render(strip`
      {{#let (element "button") as |Tag|}}\
        <Tag type="button" id="action" {{on "click" this.didClick}}>hello world!</Tag>\
      {{/let}}\
    `, { didClick: () => clicked++ });

    this.assertHTML('');

    assert
      .dom('button#action')
      .hasAttribute('type', 'button')
      .hasText('hello world!');
    assert.strictEqual(clicked, 0, 'never clicked');

    await click('button#action');

    assert.strictEqual(clicked, 1, 'clicked once');

    await click('button#action');

    assert.strictEqual(clicked, 2, 'clicked twice');

    this.assertStableRerender();
  }

  @test
  'it can be rendered multiple times'() {
    this.render(strip`
     {{#let (element "h1") as |Tag|}}
        <Tag id="content-1">hello</Tag>
        <Tag id="content-2">world</Tag>
        <Tag id="content-3">!!!!!</Tag>
      {{/let}}
    `);

    this.assertHTML('');

    assert.dom('h1#content-1').hasText('hello');
    assert.dom('h1#content-2').hasText('world');
    assert.dom('h1#content-3').hasText('!!!!!');

    this.assertStableRerender();
  }

  @test
  'it can be passed to the component helper'() {
    this.render(strip`
     {{#let (component (ensure-safe-component (element "h1"))) as |Tag|}}
        <Tag id="content-1">hello</Tag>
      {{/let}}

      {{#let (element "h2") as |h2|}}
        {{#let (ensure-safe-component h2) as |Tag|}}
          <Tag id="content-2">world</Tag>
        {{/let}}
      {{/let}}

      {{#let (element "h3") as |h3|}}
        {{#component (ensure-safe-component h3) id="content-3"}}!!!!!{{/component}}
      {{/let}}
    `);

    this.assertHTML('');

    assert.dom('h1#content-1').hasText('hello');
    assert.dom('h2#content-2').hasText('world');
    assert.dom('h3#content-3').hasText('!!!!!');

    this.assertStableRerender();
  }

  @test
  'it renders when the tag name changes'() {
    this.render(strip`
      {{#let (element this.tagName) as |Tag|}}
        <Tag id="content">rendered {{counter}} time(s)</Tag>
      {{/let}}
    `);

    this.assertHTML('');
   assert.dom('h1#content').hasText('rendered 1 time(s)');
    assert.dom('h2#content').doesNotExist();
    assert.dom('h3#content').doesNotExist();

    this.set('tagName', 'h2');

    await settled();

    assert.dom('h1#content').doesNotExist();
    assert.dom('h2#content').hasText('rendered 2 time(s)');
    assert.dom('h3#content').doesNotExist();

    this.set('tagName', 'h2');

    await settled();

    assert.dom('h1#content').doesNotExist();
    assert.dom('h2#content').hasText('rendered 2 time(s)');
    assert.dom('h3#content').doesNotExist();

    this.set('tagName', 'h3');

    await settled();

    assert.dom('h1#content').doesNotExist();
    assert.dom('h2#content').doesNotExist();
    assert.dom('h3#content').hasText('rendered 3 time(s)');

    this.set('tagName', '');

    await settled();

    assert.dom('h1#content').doesNotExist();
    assert.dom('h2#content').doesNotExist();
    assert.dom('h3#content').doesNotExist();

    assert.strictEqual(this.element.innerHTML.trim(), 'rendered 4 time(s)');

    this.set('tagName', 'h1');

    await settled();

    assert.dom('h1#content').hasText('rendered 5 time(s)');
    assert.dom('h2#content').doesNotExist();
    assert.dom('h3#content').doesNotExist();

    this.assertStableRerender();
  }

  @test
  'it can be passed as argument and works with ...attributes'() {
    this.render(strip`
      <ElementReceiver @tag={{element this.tagName}} class="extra">Test</ElementReceiver>
    `);

    this.assertHTML('');
    assert.dom('p#content').hasText('Test').hasClass('extra');

    this.set('tagName', 'div');

    await settled();

    assert.dom('div#content').hasText('Test').hasClass('extra');

    this.set('tagName', '');

    await settled();

    assert.strictEqual(this.element.innerText.trim(), 'Test');

    this.set('tagName', 'p');

    await settled();

    assert.dom('p#content').hasText('Test').hasClass('extra');

    this.assertStableRerender();
  }

  @test
  'it can be invoked inline'() {
    this.render(strip`
    `);

    this.assertHTML('');
   this.set('tagName', 'p');

    await render(hbs`{{element this.tagName}}`);

    assert.dom('p').exists();

    this.set('tagName', 'br');

    await settled();

    assert.dom('br').exists();

    this.set('tagName', '');

    assert.strictEqual(this.element.innerHTML.trim(), '<!---->');

    this.set('tagName', 'p');

    await settled();

    assert.dom('p').exists();

    this.assertStableRerender();
  }

  @test
  'invalid usage: it requires at least one argument'() {
    this.render(strip`
    `);

    this.assertHTML('');
 expectEmberError(
        new Error(
          'Assertion Failed: The `element` helper takes a single positional argument'
        )
      );

      await render(hbs`
        <div>
          {{#let (element) as |Tag|}}
            <Tag id="content">hello world!</Tag>
          {{/let}}
        </div>
      `);

    this.assertStableRerender();
  }

  @test
  'invalid usage: it requires no more than one argument'() {
    this.render(strip`
    `);

    this.assertHTML('');
  expectEmberError(
        new Error(
          'Assertion Failed: The `element` helper takes a single positional argument'
        )
      );

      await render(hbs`
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
    this.render(strip`
    `);

    this.assertHTML('');
      expectEmberError(
        new Error(
          'Assertion Failed: The `element` helper does not take any named arguments'
        )
      );

      await render(hbs`
        <div>
          {{#let (element "h1" id="content") as |Tag|}}
            <Tag id="content">hello world!</Tag>
          {{/let}}
        </div>
      `);

    this.assertStableRerender();
  }

  @test
  'invalid usage: it does not take a block'() {
    this.render(strip`
    `);

    this.assertHTML('');
  // Before the EMBER_GLIMMER_ANGLE_BRACKET_BUILT_INS feature was enabled
      // in 3.10, the "dash rule" short-circuited this assertion by accident,
      // so this was just a no-op but no error was thrown.
      if (
        macroCondition(dependencySatisfies('ember-source', '>=3.25.0-beta.0'))
      ) {
        expectEmberError(
          new Error(
            'Attempted to resolve `element`, which was expected to be a component, but nothing was found.'
          )
        );
      } else if (
        macroCondition(dependencySatisfies('ember-source', '>=3.10.0-beta.0'))
      ) {
        expectEmberError(
          new Error(
            'Assertion Failed: Helpers may not be used in the block form, for example {{#element}}{{/element}}. Please use a component, or alternatively use the helper in combination with a built-in Ember helper, for example {{#if (element)}}{{/if}}.'
          )
        );
      }

      // Due to https://github.com/glimmerjs/glimmer-vm/pull/1073, we need to
      // wrap the invalid block in a conditional to ensure the initial render
      // complete without errors. This is fixed in Ember 3.16+.
      this.set('showBlock', false);

      await render(hbs`
        <div>
          {{#if this.showBlock}}
            {{#element "h1"}}hello world!{{/element}}
          {{/if}}
        </div>
      `);

      assert.dom('h1').doesNotExist();

      this.set('showBlock', true);

      await settled();

      assert.dom('h1').doesNotExist();

    this.assertStableRerender();
  }

  @test
  'invalid usage: it throws when passed a number'() {
    this.render(strip`
    `);

    this.assertHTML('');
  expectEmberError(
        new Error(
          'Assertion Failed: The argument passed to the `element` helper must be a string (you passed `123`)'
        )
      );

      await render(hbs`
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
    this.render(strip`
    `);

    this.assertHTML('');
 expectEmberError(
        new Error(
          'Assertion Failed: The argument passed to the `element` helper must be a string (you passed `false`)'
        )
      );

      await render(hbs`
        <div>
          {{#let (element false) as |Tag|}}
            <Tag id="content">hello world!</Tag>
          {{/let}}
        </div>
      `);

    this.assertStableRerender();
  }

  @test
  'invalid usage: it throws when passed an object'() {
    this.render(strip`
    `);

    this.assertHTML('');
 expectEmberError(
        new Error(
          'Assertion Failed: The argument passed to the `element` helper must be a string'
        )
      );

      await render(hbs`
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
