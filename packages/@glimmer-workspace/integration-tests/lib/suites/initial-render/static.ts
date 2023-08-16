import { strip } from '@glimmer/util';

import { matrix } from '../../matrix';

export const InitialRenderTests = matrix('initial render (static)', (test) => {
  test('HTML text content', (ctx) => {
    ctx.render.template('content');
    ctx.assertHTML('content');
    ctx.assertStableRerender();
  });

  test('HTML tags', (ctx) => {
    ctx.render.template('<h1>hello!</h1><div>content</div>');
    ctx.assertHTML('<h1>hello!</h1><div>content</div>');
    ctx.assertStableRerender();
  });

  test('HTML attributes', (ctx) => {
    ctx.render.template("<div class='foo' id='bar'>content</div>");
    ctx.assertHTML("<div class='foo' id='bar'>content</div>");
    ctx.assertStableRerender();
  });

  test('HTML data attributes', (ctx) => {
    ctx.render.template("<div data-some-data='foo'>content</div>");
    ctx.assertHTML("<div data-some-data='foo'>content</div>");
    ctx.assertStableRerender();
  });

  test('HTML checked attributes', (ctx) => {
    ctx.render.template("<input checked='checked'>");
    ctx.assertHTML(`<input checked='checked'>`);
    ctx.assertStableRerender();
  });

  test('HTML selected options', (ctx) => {
    ctx.render.template(strip`
      <select>
        <option>1</option>
        <option selected>2</option>
        <option>3</option>
      </select>
    `);
    ctx.assertHTML(strip`
      <select>
        <option>1</option>
        <option selected>2</option>
        <option>3</option>
      </select>
    `);
    ctx.assertStableRerender();
  });

  test('HTML multi-select options', (ctx) => {
    ctx.render.template(strip`
      <select multiple>
        <option>1</option>
        <option selected>2</option>
        <option selected>3</option>
      </select>
    `);
    ctx.assertHTML(strip`
      <select multiple>
        <option>1</option>
        <option selected>2</option>
        <option selected>3</option>
      </select>
    `);
    ctx.assertStableRerender();
  });

  test('Void Elements', (ctx) => {
    const voidElements = 'area base br embed hr img input keygen link meta param source track wbr';
    voidElements.split(' ').forEach((tagName) => ctx.shouldBeVoid(tagName));
  });

  test('Nested HTML', (ctx) => {
    ctx.render.template(
      "<div class='foo'><p><span id='bar' data-foo='bar'>hi!</span></p></div>&nbsp;More content"
    );
    ctx.assertHTML(
      "<div class='foo'><p><span id='bar' data-foo='bar'>hi!</span></p></div>&nbsp;More content"
    );
    ctx.assertStableRerender();
  });

  test('Custom Elements', (ctx) => {
    ctx.render.template('<use-the-platform></use-the-platform>');
    ctx.assertHTML('<use-the-platform></use-the-platform>');
    ctx.assertStableRerender();
  });

  test('Nested Custom Elements', (ctx) => {
    ctx.render.template(
      "<use-the-platform><seriously-please data-foo='1'>Stuff <div>Here</div></seriously-please></use-the-platform>"
    );
    ctx.assertHTML(
      "<use-the-platform><seriously-please data-foo='1'>Stuff <div>Here</div></seriously-please></use-the-platform>"
    );
    ctx.assertStableRerender();
  });

  test('Moar nested Custom Elements', (ctx) => {
    ctx.render.template(
      "<use-the-platform><seriously-please data-foo='1'><wheres-the-platform>Here</wheres-the-platform></seriously-please></use-the-platform>"
    );
    ctx.assertHTML(
      "<use-the-platform><seriously-please data-foo='1'><wheres-the-platform>Here</wheres-the-platform></seriously-please></use-the-platform>"
    );
    ctx.assertStableRerender();
  });

  test('Custom Elements with dynamic attributes', (ctx) => {
    ctx.render.template(
      "<fake-thing><other-fake-thing data-src='extra-{{this.someDynamicBits}}-here' /></fake-thing>",
      { someDynamicBits: 'things' }
    );
    ctx.assertHTML("<fake-thing><other-fake-thing data-src='extra-things-here' /></fake-thing>");
    ctx.assertStableRerender();
  });

  test('Custom Elements with dynamic content', (ctx) => {
    ctx.render.template('<x-foo><x-bar>{{this.derp}}</x-bar></x-foo>', { derp: 'stuff' });
    ctx.assertHTML('<x-foo><x-bar>stuff</x-bar></x-foo>');
    ctx.assertStableRerender();
  });

  test('Dynamic content within single custom element', (ctx) => {
    ctx.render.template('<x-foo>{{#if this.derp}}Content Here{{/if}}</x-foo>', { derp: 'stuff' });
    ctx.assertHTML('<x-foo>Content Here</x-foo>');
    ctx.assertStableRerender();

    ctx.rerender({ derp: false });
    ctx.assertHTML('<x-foo><!----></x-foo>');
    ctx.assertStableRerender();

    ctx.rerender({ derp: true });
    ctx.assertHTML('<x-foo>Content Here</x-foo>');
    ctx.assertStableRerender();

    ctx.rerender({ derp: 'stuff' });
    ctx.assertHTML('<x-foo>Content Here</x-foo>');
    ctx.assertStableRerender();
  });

  test('Supports quotes', (ctx) => {
    ctx.render.template('<div>"This is a title," we\'re on a boat</div>');
    ctx.assertHTML('<div>"This is a title," we\'re on a boat</div>');
    ctx.assertStableRerender();
  });

  test('Supports backslashes', (ctx) => {
    ctx.render.template('<div>This is a backslash: \\</div>');
    ctx.assertHTML('<div>This is a backslash: \\</div>');
    ctx.assertStableRerender();
  });

  test('Supports new lines', (ctx) => {
    ctx.render.template('<div>common\n\nbro</div>');
    ctx.assertHTML('<div>common\n\nbro</div>');
    ctx.assertStableRerender();
  });

  test('HTML tag with empty attribute', (ctx) => {
    ctx.render.template("<div class=''>content</div>");
    ctx.assertHTML("<div class=''>content</div>");
    ctx.assertStableRerender();
  });

  test('Attributes containing a helper are treated like a block', (ctx) => {
    ctx.register.helper('testing', (params) => {
      ctx.assert.deepEqual(params, [123]);
      return 'example.com';
    });

    ctx.render.template('<a href="http://{{testing 123}}/index.html">linky</a>');
    ctx.assertHTML('<a href="http://example.com/index.html">linky</a>');
    ctx.assertStableRerender();
  });

  test("HTML boolean attribute 'disabled'", (ctx) => {
    ctx.render.template('<input disabled>');
    ctx.assertHTML('<input disabled>');

    // TODO: What is the point of this test? (Note that it wouldn't work with SimpleDOM)
    // assertNodeProperty(root.firstChild, 'input', 'disabled', true);

    ctx.assertStableRerender();
  });
});

InitialRenderTests.client();
