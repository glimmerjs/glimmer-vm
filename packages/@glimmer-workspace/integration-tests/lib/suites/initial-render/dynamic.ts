import type { SimpleElement } from '@glimmer/interfaces';
import { castToBrowser, checkNode, NS_SVG, strip, unwrap } from '@glimmer/util';
import {
  assertNodeTagName,
  firstElementChild,
  getElementsByTagName,
  matrix,
} from '@glimmer-workspace/integration-tests';

import { Woops } from '../../test-helpers/error';

export const DynamicInitialRenderSuite = matrix('initial render (dynamic)', (spec, errors) => {
  // @render
  // 'HTML text content'() {
  //   this.render.template('content');
  //   this.assertHTML('content');
  //   this.assertStableRerender();
  // }

  spec('Quoted attribute null values do not disable', (ctx) => {
    ctx.render.template('<input disabled="{{this.isDisabled}}">', { isDisabled: null });
    ctx.assertHTML('<input>');
    ctx.assertStableRerender();

    // TODO: What is the point of this test? (Note that it wouldn't work with SimpleDOM)
    // assertNodeProperty(root.firstChild, 'input', 'disabled', false);

    ctx.rerender({ isDisabled: true });
    ctx.assertHTML('<input disabled>');
    ctx.assertStableNodes();

    // TODO: ??????????
    ctx.rerender({ isDisabled: false });
    ctx.assertHTML('<input disabled>');
    ctx.assertStableNodes();

    ctx.rerender({ isDisabled: null });
    ctx.assertHTML('<input>');
    ctx.assertStableNodes();
  });

  spec('Unquoted attribute null values do not disable', (ctx) => {
    ctx.render.template('<input disabled={{this.isDisabled}}>', { isDisabled: null });
    ctx.assertHTML('<input>');
    ctx.assertStableRerender();

    // TODO: What is the point of this test? (Note that it wouldn't work with SimpleDOM)
    // assertNodeProperty(root.firstChild, 'input', 'disabled', false);

    ctx.rerender({ isDisabled: true });
    ctx.assertHTML('<input disabled>');
    ctx.assertStableRerender();

    ctx.rerender({ isDisabled: false });
    ctx.assertHTML('<input>');
    ctx.assertStableRerender();

    ctx.rerender({ isDisabled: null });
    ctx.assertHTML('<input>');
    ctx.assertStableRerender();
  });

  spec('Quoted attribute string values', (ctx) => {
    ctx.render.template("<img src='{{this.src}}'>", { src: 'image.png' });
    ctx.assertHTML("<img src='image.png'>");
    ctx.assertStableRerender();

    ctx.rerender({ src: 'newimage.png' });
    ctx.assertHTML("<img src='newimage.png'>");
    ctx.assertStableNodes();

    ctx.rerender({ src: '' });
    ctx.assertHTML("<img src=''>");
    ctx.assertStableNodes();

    ctx.rerender({ src: 'image.png' });
    ctx.assertHTML("<img src='image.png'>");
    ctx.assertStableNodes();
  });

  errors('Quoted attribute string values', {
    template: "<p>{{#-try}}before<img src='{{value}}'>after{{/-try}}</p>",
    value: 'image.png',
  });

  spec('Unquoted attribute string values', (ctx) => {
    ctx.render.template('<img src={{this.src}}>', { src: 'image.png' });
    ctx.assertHTML("<img src='image.png'>");
    ctx.assertStableRerender();

    ctx.rerender({ src: 'newimage.png' });
    ctx.assertHTML("<img src='newimage.png'>");
    ctx.assertStableNodes();

    ctx.rerender({ src: '' });
    ctx.assertHTML("<img src=''>");
    ctx.assertStableNodes();

    ctx.rerender({ src: 'image.png' });
    ctx.assertHTML("<img src='image.png'>");
    ctx.assertStableNodes();
  });

  errors('Unquoted attribute string values', {
    template: '<p>{{#-try}}before<img src={{value}}>after{{/-try}}</p>',
    value: 'image.png',
  });

  spec('Unquoted img src attribute is not rendered when set to `null`', (ctx) => {
    ctx.render.template("<img src='{{this.src}}'>", { src: null });
    ctx.assertHTML('<img>');
    ctx.assertStableRerender();

    ctx.rerender({ src: 'newimage.png' });
    ctx.assertHTML("<img src='newimage.png'>");
    ctx.assertStableNodes();

    ctx.rerender({ src: '' });
    ctx.assertHTML("<img src=''>");
    ctx.assertStableNodes();

    ctx.rerender({ src: null });
    ctx.assertHTML('<img>');
    ctx.assertStableNodes();
  });

  spec('Unquoted img src attribute is not rendered when set to `undefined`', (ctx) => {
    ctx.render.template("<img src='{{this.src}}'>", { src: undefined });
    ctx.assertHTML('<img>');
    ctx.assertStableRerender();

    ctx.rerender({ src: 'newimage.png' });
    ctx.assertHTML("<img src='newimage.png'>");
    ctx.assertStableNodes();

    ctx.rerender({ src: '' });
    ctx.assertHTML("<img src=''>");
    ctx.assertStableNodes();

    ctx.rerender({ src: undefined });
    ctx.assertHTML('<img>');
    ctx.assertStableNodes();
  });

  spec('Unquoted a href attribute is not rendered when set to `null`', (ctx) => {
    ctx.render.template('<a href={{this.href}}></a>', { href: null });
    ctx.assertHTML('<a></a>');
    ctx.assertStableRerender();

    ctx.rerender({ href: 'http://example.com' });
    ctx.assertHTML("<a href='http://example.com'></a>");
    ctx.assertStableNodes();

    ctx.rerender({ href: '' });
    ctx.assertHTML("<a href=''></a>");
    ctx.assertStableNodes();

    ctx.rerender({ href: null });
    ctx.assertHTML('<a></a>');
    ctx.assertStableNodes();
  });

  spec('Unquoted a href attribute is not rendered when set to `undefined`', (ctx) => {
    ctx.render.template('<a href={{this.href}}></a>', { href: undefined });
    ctx.assertHTML('<a></a>');
    ctx.assertStableRerender();

    ctx.rerender({ href: 'http://example.com' });
    ctx.assertHTML("<a href='http://example.com'></a>");
    ctx.assertStableNodes();

    ctx.rerender({ href: '' });
    ctx.assertHTML("<a href=''></a>");
    ctx.assertStableNodes();

    ctx.rerender({ href: undefined });
    ctx.assertHTML('<a></a>');
    ctx.assertStableNodes();
  });

  errors('Attribute expression can be followed by another attribute', {
    template: "<div>{{#-try}}before<p foo='{{value}}' name='Alice'></p>after{{/-try}}</div>",
    value: 'oh my',
  });

  spec('Attribute expression can be followed by another attribute', (ctx) => {
    ctx.render.template("<div foo='{{this.funstuff}}' name='Alice'></div>", { funstuff: 'oh my' });
    ctx.assertHTML("<div name='Alice' foo='oh my'></div>");
    ctx.assertStableRerender();

    ctx.rerender({ funstuff: 'oh boy' });
    ctx.assertHTML("<div name='Alice' foo='oh boy'></div>");
    ctx.assertStableNodes();

    ctx.rerender({ funstuff: '' });
    ctx.assertHTML("<div name='Alice' foo=''></div>");
    ctx.assertStableNodes();

    ctx.rerender({ funstuff: 'oh my' });
    ctx.assertHTML("<div name='Alice' foo='oh my'></div>");
    ctx.assertStableNodes();
  });

  spec('Dynamic selected options', (ctx) => {
    ctx.render.template(
      strip`
      <select>
        <option>1</option>
        <option selected={{this.selected}}>2</option>
        <option>3</option>
      </select>
    `,
      { selected: true }
    );

    ctx.assertHTML(strip`
      <select>
        <option>1</option>
        <option ${ctx.name === 'rehydration' ? ' selected=true' : ''}>2</option>
        <option>3</option>
      </select>
    `);

    let selectNode = checkNode(castToBrowser(ctx.element, 'HTML').firstElementChild, 'select');
    ctx.assert.strictEqual(selectNode.selectedIndex, 1);
    ctx.assertStableRerender();

    ctx.rerender({ selected: false });
    ctx.assertHTML(strip`
      <select>
        <option>1</option>
        <option ${ctx.name === 'rehydration' ? ' selected=true' : ''}>2</option>
        <option>3</option>
      </select>
    `);

    selectNode = checkNode(castToBrowser(ctx.element, 'HTML').firstElementChild, 'select');

    ctx.assert.strictEqual(selectNode.selectedIndex, 0);

    ctx.assertStableNodes();

    ctx.rerender({ selected: '' });

    ctx.assertHTML(strip`
      <select>
        <option>1</option>
        <option ${ctx.name === 'rehydration' ? ' selected=true' : ''}>2</option>
        <option>3</option>
      </select>
    `);

    selectNode = checkNode(castToBrowser(ctx.element, 'HTML').firstElementChild, 'select');

    ctx.assert.strictEqual(selectNode.selectedIndex, 0);

    ctx.assertStableNodes();

    ctx.rerender({ selected: true });
    ctx.assertHTML(strip`
      <select>
        <option>1</option>
        <option ${ctx.name === 'rehydration' ? ' selected=true' : ''}>2</option>
        <option>3</option>
      </select>
    `);

    selectNode = checkNode(castToBrowser(ctx.element, 'HTML').firstElementChild, 'select');
    ctx.assert.strictEqual(selectNode.selectedIndex, 1);
    ctx.assertStableNodes();
  });

  spec('Dynamic multi-select', (ctx) => {
    ctx.render.template(
      strip`
      <select multiple>
        <option>0</option>
        <option selected={{this.somethingTrue}}>1</option>
        <option selected={{this.somethingTruthy}}>2</option>
        <option selected={{this.somethingUndefined}}>3</option>
        <option selected={{this.somethingNull}}>4</option>
        <option selected={{this.somethingFalse}}>5</option>
      </select>`,
      {
        somethingTrue: true,
        somethingTruthy: 'is-true',
        somethingUndefined: undefined,
        somethingNull: null,
        somethingFalse: false,
      }
    );

    const selectNode = firstElementChild(ctx.element);
    ctx.assert.ok(selectNode, 'rendered select');
    if (selectNode === null) {
      return;
    }
    const options = getElementsByTagName(selectNode, 'option');
    const selected: SimpleElement[] = [];

    for (const option of options) {
      // TODO: This is a real discrepancy with SimpleDOM
      if ((option as any).selected) {
        selected.push(option);
      }
    }

    const [first, second] = ctx.guardArray({ selected }, { min: 2 });

    ctx.assertHTML(strip`
      <select multiple="">
        <option>0</option>
        <option ${ctx.name === 'rehydration' ? ' selected=true' : ''}>1</option>
        <option ${ctx.name === 'rehydration' ? ' selected=true' : ''}>2</option>
        <option>3</option>
        <option>4</option>
        <option>5</option>
      </select>`);

    ctx.assert.strictEqual(selected.length, 2, 'two options are selected');
    ctx.assert.strictEqual(castToBrowser(first, 'option').value, '1', 'first selected item is "1"');
    ctx.assert.strictEqual(
      castToBrowser(second, 'option').value,
      '2',
      'second selected item is "2"'
    );
  });

  spec('HTML comments', (ctx) => {
    ctx.render.template('<div><!-- Just passing through --></div>');
    ctx.assertHTML('<div><!-- Just passing through --></div>');
    ctx.assertStableRerender();
  });

  spec('Curlies in HTML comments', (ctx) => {
    ctx.render.template('<div><!-- {{this.foo}} --></div>', { foo: 'foo' });
    ctx.assertHTML('<div><!-- {{this.foo}} --></div>');
    ctx.assertStableRerender();

    ctx.rerender({ foo: 'bar' });
    ctx.assertHTML('<div><!-- {{this.foo}} --></div>');
    ctx.assertStableNodes();

    ctx.rerender({ foo: '' });
    ctx.assertHTML('<div><!-- {{this.foo}} --></div>');
    ctx.assertStableNodes();

    ctx.rerender({ foo: 'foo' });
    ctx.assertHTML('<div><!-- {{this.foo}} --></div>');
    ctx.assertStableNodes();
  });

  spec('Complex Curlies in HTML comments', (ctx) => {
    ctx.render.template('<div><!-- {{this.foo bar baz}} --></div>', { foo: 'foo' });
    ctx.assertHTML('<div><!-- {{this.foo bar baz}} --></div>');
    ctx.assertStableRerender();

    ctx.rerender({ foo: 'bar' });
    ctx.assertHTML('<div><!-- {{this.foo bar baz}} --></div>');
    ctx.assertStableNodes();

    ctx.rerender({ foo: '' });
    ctx.assertHTML('<div><!-- {{this.foo bar baz}} --></div>');
    ctx.assertStableNodes();

    ctx.rerender({ foo: 'foo' });
    ctx.assertHTML('<div><!-- {{this.foo bar baz}} --></div>');
    ctx.assertStableNodes();
  });

  spec('HTML comments with multi-line mustaches', (ctx) => {
    ctx.render.template('<div><!-- {{#each foo as |bar|}}\n{{bar}}\n\n{{/each}} --></div>');
    ctx.assertHTML('<div><!-- {{#each foo as |bar|}}\n{{bar}}\n\n{{/each}} --></div>');
    ctx.assertStableRerender();
  });

  spec('Top level comments', (ctx) => {
    ctx.render.template('<!-- {{this.foo}} -->');
    ctx.assertHTML('<!-- {{this.foo}} -->');
    ctx.assertStableRerender();
  });

  spec('Handlebars comments', (ctx) => {
    ctx.render.template('<div>{{! Better not break! }}content</div>');
    ctx.assertHTML('<div>content</div>');
    ctx.assertStableRerender();
  });

  errors('Namespaced attribute', {
    template: `<svg xmlns:xlink="http://www.w3.org/1999/xlink">{{#-try}}<use xlink:href="{{value}}"></use>{{/-try}}</svg>`,
    value: 'home',
  });

  spec('Namespaced attribute', (ctx) => {
    ctx.render.template("<svg xlink:title='svg-title'>content</svg>");
    ctx.assertHTML("<svg xlink:title='svg-title'>content</svg>");
    ctx.assertStableRerender();
  });

  spec('svg href attribute with quotation marks', (ctx) => {
    ctx.render.template(
      `<svg xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="{{this.iconLink}}"></use></svg>`,
      { iconLink: 'home' }
    );
    ctx.assertHTML(
      `<svg xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="home"></use></svg>`
    );
    const svg = ctx.element.firstChild;
    if (assertNodeTagName(svg, 'svg')) {
      const use = svg.firstChild;
      if (assertNodeTagName(use, 'use')) {
        ctx.assert.strictEqual(use.href.baseVal, 'home');
      }
    }
  });

  spec('svg href attribute without quotation marks', (ctx) => {
    ctx.render.template(
      `<svg xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href={{this.iconLink}}></use></svg>`,
      { iconLink: 'home' }
    );
    ctx.assertHTML(
      `<svg xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="home"></use></svg>`
    );
    const svg = ctx.element.firstChild;
    if (assertNodeTagName(svg, 'svg')) {
      const use = svg.firstChild;
      if (assertNodeTagName(use, 'use')) {
        ctx.assert.strictEqual(use.href.baseVal, 'home');
      }
    }
  });

  spec('<svg> tag with case-sensitive attribute', (ctx) => {
    ctx.render.template('<svg viewBox="0 0 0 0"></svg>');
    ctx.assertHTML('<svg viewBox="0 0 0 0"></svg>');
    const svg = ctx.element.firstChild;
    if (assertNodeTagName(svg, 'svg')) {
      ctx.assert.strictEqual(svg.namespaceURI, NS_SVG);
      ctx.assert.strictEqual(svg.getAttribute('viewBox'), '0 0 0 0');
    }
    ctx.assertStableRerender();
  });

  spec('nested element in the SVG namespace', (ctx) => {
    const d = 'M 0 0 L 100 100';
    ctx.render.template(`<svg><path d="${d}"></path></svg>`);
    ctx.assertHTML(`<svg><path d="${d}"></path></svg>`);

    const svg = ctx.element.firstChild;

    if (assertNodeTagName(svg, 'svg')) {
      ctx.assert.strictEqual(svg.namespaceURI, NS_SVG);

      const path = svg.firstChild;
      if (assertNodeTagName(path, 'path')) {
        ctx.assert.strictEqual(
          path.namespaceURI,
          NS_SVG,
          'creates the path element with a namespace'
        );
        ctx.assert.strictEqual(path.getAttribute('d'), d);
      }
    }

    ctx.assertStableRerender();
  });

  spec('<foreignObject> tag has an SVG namespace', (ctx) => {
    ctx.render.template('<svg><foreignObject>Hi</foreignObject></svg>');
    ctx.assertHTML('<svg><foreignObject>Hi</foreignObject></svg>');

    const svg = ctx.element.firstChild;

    if (assertNodeTagName(svg, 'svg')) {
      ctx.assert.strictEqual(svg.namespaceURI, NS_SVG);

      const foreignObject = svg.firstChild;

      if (assertNodeTagName(foreignObject, 'foreignObject')) {
        ctx.assert.strictEqual(
          foreignObject.namespaceURI,
          NS_SVG,
          'creates the foreignObject element with a namespace'
        );
      }
    }

    ctx.assertStableRerender();
  });

  spec('Namespaced and non-namespaced elements as siblings', (ctx) => {
    ctx.render.template('<svg></svg><svg></svg><div></div>');
    ctx.assertHTML('<svg></svg><svg></svg><div></div>');

    const [firstChild, secondChild, thirdChild] = ctx.guardArray(
      { childNodes: ctx.element.childNodes },
      { min: 3 }
    );

    ctx.assert.strictEqual(
      castToBrowser(unwrap(firstChild), 'SVG').namespaceURI,
      NS_SVG,
      'creates the first svg element with a namespace'
    );

    ctx.assert.strictEqual(
      castToBrowser(secondChild, 'SVG').namespaceURI,
      NS_SVG,
      'creates the second svg element with a namespace'
    );

    ctx.assert.strictEqual(
      castToBrowser(thirdChild, 'HTML').namespaceURI,
      XHTML_NAMESPACE,
      'creates the div element without a namespace'
    );

    ctx.assertStableRerender();
  });

  spec('Namespaced and non-namespaced elements with nesting', (ctx) => {
    ctx.render.template('<div><svg></svg></div><div></div>');

    const firstDiv = ctx.element.firstChild;
    const secondDiv = ctx.element.lastChild;
    const svg = firstDiv && firstDiv.firstChild;

    ctx.assertHTML('<div><svg></svg></div><div></div>');

    if (assertNodeTagName(firstDiv, 'div')) {
      ctx.assert.strictEqual(
        firstDiv.namespaceURI,
        XHTML_NAMESPACE,
        "first div's namespace is xhtmlNamespace"
      );
    }

    if (assertNodeTagName(svg, 'svg')) {
      ctx.assert.strictEqual(svg.namespaceURI, NS_SVG, "svg's namespace is svgNamespace");
    }

    if (assertNodeTagName(secondDiv, 'div')) {
      ctx.assert.strictEqual(
        secondDiv.namespaceURI,
        XHTML_NAMESPACE,
        "last div's namespace is xhtmlNamespace"
      );
    }

    ctx.assertStableRerender();
  });

  spec('Case-sensitive tag has capitalization preserved', (ctx) => {
    ctx.render.template('<svg><linearGradient id="gradient"></linearGradient></svg>');
    ctx.assertHTML('<svg><linearGradient id="gradient"></linearGradient></svg>');
    ctx.assertStableRerender();
  });

  errors('Text curlies', {
    template: '<div>{{#-try}}{{value}}<span>{{value}}</span>{{/-try}}</div>',
    value: 'hello',
  });

  spec('Text curlies', (ctx) => {
    ctx.render.template('<div>{{this.title}}<span>{{this.title}}</span></div>', {
      title: 'hello',
    });
    ctx.assertHTML('<div>hello<span>hello</span></div>');
    ctx.assertStableRerender();

    ctx.rerender({ title: 'goodbye' });
    ctx.assertHTML('<div>goodbye<span>goodbye</span></div>');
    ctx.assertStableNodes();

    ctx.rerender({ title: '' });
    ctx.assertHTML('<div><span></span></div>');
    ctx.assertStableNodes();

    ctx.rerender({ title: 'hello' });
    ctx.assertHTML('<div>hello<span>hello</span></div>');
    ctx.assertStableNodes();
  });

  spec('Text curlies (error handling)', (ctx) => {
    const woops = Woops.noop();

    ctx.render.template(
      '<div>{{#-try this.woops.handleError}}<span>{{this.woops.value}}</span>{{/-try}}<span>{{this.title}}</span></div>',
      { woops, title: 'hello' }
    );

    ctx.assertHTML('<div><span>no woops</span><span>hello</span></div>');
    woops.isError = true;

    // ctx.rerender();
    // ctx.assertHTML('<div><span>hello</span></div>');
  });

  spec('Repaired text nodes are ensured in the right place Part 1', (ctx) => {
    ctx.render.template('{{this.a}} {{this.b}}', { a: 'A', b: 'B', c: 'C', d: 'D' });
    ctx.assertHTML('A B');
    ctx.assertStableRerender();
  });

  spec('Repaired text nodes are ensured in the right place Part 2', (ctx) => {
    ctx.render.template('<div>{{this.a}}{{this.b}}{{this.c}}wat{{this.d}}</div>', {
      a: 'A',
      b: 'B',
      c: 'C',
      d: 'D',
    });
    ctx.assertHTML('<div>ABCwatD</div>');
    ctx.assertStableRerender();
  });

  spec('Repaired text nodes are ensured in the right place Part 3', (ctx) => {
    ctx.render.template('{{this.a}}{{this.b}}<img><img><img><img>', {
      a: 'A',
      b: 'B',
      c: 'C',
      d: 'D',
    });
    ctx.assertHTML('AB<img><img><img><img>');
    ctx.assertStableRerender();
  });

  spec('Path expressions', (ctx) => {
    ctx.render.template('<div>{{this.model.foo.bar}}<span>{{this.model.foo.bar}}</span></div>', {
      model: { foo: { bar: 'hello' } },
    });
    ctx.assertHTML('<div>hello<span>hello</span></div>');
    ctx.assertStableRerender();

    ctx.rerender({ model: { foo: { bar: 'goodbye' } } });
    ctx.assertHTML('<div>goodbye<span>goodbye</span></div>');
    ctx.assertStableNodes();

    ctx.rerender({ model: { foo: { bar: '' } } });
    ctx.assertHTML('<div><span></span></div>');
    ctx.assertStableNodes();

    ctx.rerender({ model: { foo: { bar: 'hello' } } });
    ctx.assertHTML('<div>hello<span>hello</span></div>');
    ctx.assertStableNodes();
  });

  errors(`Text curlies produce text nodes (not HTML)`, {
    template: `<div>{{#-try}}{{value}}<span>{{value}}</span>{{/-try}}</div>`,
    value: `<strong>hello</strong>`,
  });

  spec('Text curlies produce text nodes (not HTML)', (ctx) => {
    ctx.render.template('<div>{{this.title}}<span>{{this.title}}</span></div>', {
      title: '<strong>hello</strong>',
    });
    ctx.assertHTML(
      '<div>&lt;strong&gt;hello&lt;/strong&gt;<span>&lt;strong>hello&lt;/strong&gt;</span></div>'
    );
    ctx.assertStableRerender();

    ctx.rerender({ title: '<i>goodbye</i>' });
    ctx.assertHTML('<div>&lt;i&gt;goodbye&lt;/i&gt;<span>&lt;i&gt;goodbye&lt;/i&gt;</span></div>');
    ctx.assertStableNodes();

    ctx.rerender({ title: '' });
    ctx.assertHTML('<div><span></span></div>');
    ctx.assertStableNodes();

    ctx.rerender({ title: '<strong>hello</strong>' });
    ctx.assertHTML(
      '<div>&lt;strong&gt;hello&lt;/strong&gt;<span>&lt;strong>hello&lt;/strong&gt;</span></div>'
    );
    ctx.assertStableNodes();
  });

  errors(`whitespace`, {
    template: `<div>{{#-try}}Hello {{value}}{{/-try}}</div>`,
    value: `world`,
  });

  spec('Rerender respects whitespace', (ctx) => {
    ctx.render.template('Hello {{ this.foo }} ', { foo: 'bar' });
    ctx.assertHTML('Hello bar ');
    ctx.assertStableRerender();

    ctx.rerender({ foo: 'baz' });
    ctx.assertHTML('Hello baz ');
    ctx.assertStableNodes();

    ctx.rerender({ foo: '' });
    ctx.assertHTML('Hello  ');
    ctx.assertStableNodes();

    ctx.rerender({ foo: 'bar' });
    ctx.assertHTML('Hello bar ');
    ctx.assertStableNodes();
  });

  spec('Safe HTML curlies', (ctx) => {
    const title = {
      toHTML() {
        return '<span>hello</span> <em>world</em>';
      },
    };
    ctx.render.template('<div>{{this.title}}</div>', { title });
    ctx.assertHTML('<div><span>hello</span> <em>world</em></div>');
    ctx.assertStableRerender();
  });

  spec('Triple curlies', (ctx) => {
    const title = '<span>hello</span> <em>world</em>';
    ctx.render.template('<div>{{{this.title}}}</div>', { title });
    ctx.assertHTML('<div><span>hello</span> <em>world</em></div>');
    ctx.assertStableRerender();
  });

  spec('Triple curlie helpers', (ctx) => {
    ctx.register.helper('unescaped', ([param]) => param);
    ctx.register.helper('escaped', ([param]) => param);
    ctx.render.template(
      '{{{unescaped "<strong>Yolo</strong>"}}} {{escaped "<strong>Yolo</strong>"}}'
    );
    ctx.assertHTML('<strong>Yolo</strong> &lt;strong&gt;Yolo&lt;/strong&gt;');
    ctx.assertStableRerender();
  });

  spec('Top level triple curlies', (ctx) => {
    const title = '<span>hello</span> <em>world</em>';
    ctx.render.template('{{{this.title}}}', { title });
    ctx.assertHTML('<span>hello</span> <em>world</em>');
    ctx.assertStableRerender();
  });

  errors(`Top level triple curlies`, {
    template: `{{#-try}}{{{value}}}{{/-try}}`,
    value: `<span>hello</span> <em>world</em>`,
  });

  spec('Top level unescaped tr', (ctx) => {
    const title = '<tr><td>Yo</td></tr>';
    ctx.render.template('<table>{{{this.title}}}</table>', { title });
    ctx.assertHTML('<table><tbody><tr><td>Yo</td></tr></tbody></table>');
    ctx.assertStableRerender();
  });

  errors(`Top level unescaped tr`, {
    template: `<table>{{#-try}}{{{value}}}{{/-try}}</table>`,
    value: `<tr><td>Yo</td></tr>`,
  });

  spec('The compiler can handle top-level unescaped td inside tr contextualElement', (ctx) => {
    ctx.render.template('{{{this.html}}}', { html: '<td>Yo</td>' });
    ctx.assertHTML('<tr><td>Yo</td></tr>');
    ctx.assertStableRerender();
  });

  errors(`unescaped td inside tr`, {
    template: `{{#-try}}{{{value}}}{{/-try}}`,
    value: `<td>Yo</td>`,
  });

  spec('Extreme nesting', (ctx) => {
    ctx.render.template(
      '{{this.foo}}<span>{{this.bar}}<a>{{this.baz}}<em>{{this.boo}}{{this.brew}}</em>{{this.bat}}</a></span><span><span>{{this.flute}}</span></span>{{this.argh}}',
      {
        foo: 'FOO',
        bar: 'BAR',
        baz: 'BAZ',
        boo: 'BOO',
        brew: 'BREW',
        bat: 'BAT',
        flute: 'FLUTE',
        argh: 'ARGH',
      }
    );
    ctx.assertHTML(
      'FOO<span>BAR<a>BAZ<em>BOOBREW</em>BAT</a></span><span><span>FLUTE</span></span>ARGH'
    );
    ctx.assertStableRerender();
  });

  spec('Simple blocks', (ctx) => {
    ctx.render.template('<div>{{#if this.admin}}<p>{{this.user}}</p>{{/if}}!</div>', {
      admin: true,
      user: 'chancancode',
    });
    ctx.assertHTML('<div><p>chancancode</p>!</div>');
    ctx.assertStableRerender();

    const p = ctx.element.firstChild!.firstChild!;

    ctx.rerender({ admin: false });
    ctx.assertHTML('<div><!---->!</div>');
    ctx.assertStableNodes({ except: p });

    const comment = ctx.element.firstChild!.firstChild!;

    ctx.rerender({ admin: true });
    ctx.assertHTML('<div><p>chancancode</p>!</div>');
    ctx.assertStableNodes({ except: comment });
  });

  spec('Nested blocks', (ctx) => {
    ctx.render.template(
      '<div>{{#if this.admin}}{{#if this.access}}<p>{{this.user}}</p>{{/if}}{{/if}}!</div>',
      {
        admin: true,
        access: true,
        user: 'chancancode',
      }
    );
    ctx.assertHTML('<div><p>chancancode</p>!</div>');
    ctx.assertStableRerender();

    let p = ctx.element.firstChild!.firstChild!;

    ctx.rerender({ admin: false });
    ctx.assertHTML('<div><!---->!</div>');
    ctx.assertStableNodes({ except: p });

    const comment = ctx.element.firstChild!.firstChild!;

    ctx.rerender({ admin: true });
    ctx.assertHTML('<div><p>chancancode</p>!</div>');
    ctx.assertStableNodes({ except: comment });

    p = ctx.element.firstChild!.firstChild!;

    ctx.rerender({ access: false });
    ctx.assertHTML('<div><!---->!</div>');
    ctx.assertStableNodes({ except: p });
  });

  spec('Loops', (ctx) => {
    ctx.render.template(
      '<div>{{#each this.people key="handle" as |p|}}<span>{{p.handle}}</span> - {{p.name}}{{/each}}</div>',
      {
        people: [
          { handle: 'tomdale', name: 'Tom Dale' },
          { handle: 'chancancode', name: 'Godfrey Chan' },
          { handle: 'wycats', name: 'Yehuda Katz' },
        ],
      }
    );

    ctx.assertHTML(
      '<div><span>tomdale</span> - Tom Dale<span>chancancode</span> - Godfrey Chan<span>wycats</span> - Yehuda Katz</div>'
    );
    ctx.assertStableRerender();

    ctx.rerender({
      people: [
        { handle: 'tomdale', name: 'Thomas Dale' },
        { handle: 'wycats', name: 'Yehuda Katz' },
      ],
    });

    ctx.assertHTML(
      '<div><span>tomdale</span> - Thomas Dale<span>wycats</span> - Yehuda Katz</div>'
    );
  });

  spec('Simple helpers', (ctx) => {
    ctx.register.helper('testing', ([id]) => id);
    ctx.render.template('<div>{{testing this.title}}</div>', { title: 'hello' });
    ctx.assertHTML('<div>hello</div>');
    ctx.assertStableRerender();
  });

  spec('Constant negative numbers can render', (ctx) => {
    ctx.register.helper('testing', ([id]) => id);
    ctx.render.template('<div>{{testing -123321}}</div>');
    ctx.assertHTML('<div>-123321</div>');
    ctx.assertStableRerender();
  });

  spec('Large numeric literals (Number.MAX_SAFE_INTEGER)', (ctx) => {
    ctx.register.helper('testing', ([id]) => id);
    ctx.render.template('<div>{{testing 9007199254740991}}</div>');
    ctx.assertHTML('<div>9007199254740991</div>');
    ctx.assertStableRerender();
  });

  spec('Integer powers of 2', (ctx) => {
    const ints = [];
    let i = 9007199254740991; // Number.MAX_SAFE_INTEGER isn't available on IE11
    while (i > 1) {
      ints.push(i);
      i = Math.round(i / 2);
    }
    i = -9007199254740991; // Number.MIN_SAFE_INTEGER isn't available on IE11
    while (i < -1) {
      ints.push(i);
      i = Math.round(i / 2);
    }
    ctx.register.helper('testing', ([id]) => id);
    ctx.render.template(ints.map((i) => `{{${i}}}`).join('-'));
    ctx.assertHTML(ints.map((i) => `${i}`).join('-'));
    ctx.assertStableRerender();
  });

  spec('odd integers', (ctx) => {
    ctx.render.template(
      '{{4294967296}} {{4294967295}} {{4294967294}} {{536870913}} {{536870912}} {{536870911}} {{268435455}}'
    );
    ctx.assertHTML('4294967296 4294967295 4294967294 536870913 536870912 536870911 268435455');
    ctx.assertStableRerender();
  });

  spec('Constant float numbers can render', (ctx) => {
    ctx.register.helper('testing', ([id]) => id);
    ctx.render.template('<div>{{testing 0.123}}</div>');
    ctx.assertHTML('<div>0.123</div>');
    ctx.assertStableRerender();
  });

  spec('GH#13999 The compiler can handle simple helpers with inline null parameter', (ctx) => {
    let value;
    ctx.register.helper('say-hello', (params) => {
      value = params[0];
      return 'hello';
    });
    ctx.render.template('<div>{{say-hello null}}</div>');
    ctx.assertHTML('<div>hello</div>');
    ctx.assert.strictEqual(value, null, 'is null');
    ctx.assertStableRerender();
  });

  spec(
    'GH#13999 The compiler can handle simple helpers with inline string literal null parameter',
    (ctx) => {
      let value;
      ctx.register.helper('say-hello', (params) => {
        value = params[0];
        return 'hello';
      });

      ctx.render.template('<div>{{say-hello "null"}}</div>');
      ctx.assertHTML('<div>hello</div>');
      ctx.assert.strictEqual(value, 'null', 'is null string literal');
      ctx.assertStableRerender();
    }
  );

  spec('GH#13999 The compiler can handle simple helpers with inline undefined parameter', (ctx) => {
    let value: unknown = 'PLACEHOLDER';
    let length;
    ctx.register.helper('say-hello', (params) => {
      length = params.length;
      value = params[0];
      return 'hello';
    });

    ctx.render.template('<div>{{say-hello undefined}}</div>');
    ctx.assertHTML('<div>hello</div>');
    ctx.assert.strictEqual(length, 1);
    ctx.assert.strictEqual(value, undefined, 'is undefined');
    ctx.assertStableRerender();
  });

  spec(
    'GH#13999 The compiler can handle simple helpers with positional parameter undefined string literal',
    (ctx) => {
      let value: unknown = 'PLACEHOLDER';
      let length;
      ctx.register.helper('say-hello', (params) => {
        length = params.length;
        value = params[0];
        return 'hello';
      });

      ctx.render.template('<div>{{say-hello "undefined"}} undefined</div>');
      ctx.assertHTML('<div>hello undefined</div>');
      ctx.assert.strictEqual(length, 1);
      ctx.assert.strictEqual(value, 'undefined', 'is undefined string literal');
      ctx.assertStableRerender();
    }
  );

  spec('GH#13999 The compiler can handle components with undefined named arguments', (ctx) => {
    let value: unknown = 'PLACEHOLDER';
    ctx.register.helper('say-hello', (_, hash) => {
      value = hash['foo'];
      return 'hello';
    });

    ctx.render.template('<div>{{say-hello foo=undefined}}</div>');
    ctx.assertHTML('<div>hello</div>');
    ctx.assert.strictEqual(value, undefined, 'is undefined');
    ctx.assertStableRerender();
  });

  spec(
    'GH#13999 The compiler can handle components with undefined string literal named arguments',
    (ctx) => {
      let value: unknown = 'PLACEHOLDER';
      ctx.register.helper('say-hello', (_, hash) => {
        value = hash['foo'];
        return 'hello';
      });

      ctx.render.template('<div>{{say-hello foo="undefined"}}</div>');
      ctx.assertHTML('<div>hello</div>');
      ctx.assert.strictEqual(value, 'undefined', 'is undefined string literal');
      ctx.assertStableRerender();
    }
  );

  spec('GH#13999 The compiler can handle components with null named arguments', (ctx) => {
    let value;
    ctx.register.helper('say-hello', (_, hash) => {
      value = hash['foo'];
      return 'hello';
    });

    ctx.render.template('<div>{{say-hello foo=null}}</div>');
    ctx.assertHTML('<div>hello</div>');
    ctx.assert.strictEqual(value, null, 'is null');
    ctx.assertStableRerender();
  });

  spec(
    'GH#13999 The compiler can handle components with null string literal named arguments',
    (ctx) => {
      let value;
      ctx.register.helper('say-hello', (_, hash) => {
        value = hash['foo'];
        return 'hello';
      });

      ctx.render.template('<div>{{say-hello foo="null"}}</div>');
      ctx.assertHTML('<div>hello</div>');
      ctx.assert.strictEqual(value, 'null', 'is null string literal');
      ctx.assertStableRerender();
    }
  );

  spec('Null curly in attributes', (ctx) => {
    ctx.render.template('<div class="foo {{null}}">hello</div>');
    ctx.assertHTML('<div class="foo ">hello</div>');
    ctx.assertStableRerender();
  });

  spec('Null in primitive syntax', (ctx) => {
    ctx.render.template('{{#if null}}NOPE{{else}}YUP{{/if}}');
    ctx.assertHTML('YUP');
    ctx.assertStableRerender();
  });

  spec('Sexpr helpers', (ctx) => {
    ctx.register.helper('testing', (params) => {
      return `${params[0]}!`;
    });

    ctx.render.template('<div>{{testing (testing "hello")}}</div>');
    ctx.assertHTML('<div>hello!!</div>');
    ctx.assertStableRerender();
  });

  spec('The compiler can handle multiple invocations of sexprs', (ctx) => {
    ctx.register.helper('testing', (params) => {
      return `${params[0]}${params[1]}`;
    });

    ctx.render.template(
      '<div>{{testing (testing "hello" this.foo) (testing (testing this.bar "lol") this.baz)}}</div>',
      {
        foo: 'FOO',
        bar: 'BAR',
        baz: 'BAZ',
      }
    );
    ctx.assertHTML('<div>helloFOOBARlolBAZ</div>');
    ctx.assertStableRerender();
  });

  spec('The compiler passes along the hash arguments', (ctx) => {
    ctx.register.helper('testing', (_, hash) => {
      return `${hash['first']}-${hash['second']}`;
    });

    ctx.render.template('<div>{{testing first="one" second="two"}}</div>');
    ctx.assertHTML('<div>one-two</div>');
    ctx.assertStableRerender();
  });

  spec('Attributes can be populated with helpers that generate a string', (ctx) => {
    ctx.register.helper('testing', (params) => {
      return params[0];
    });

    ctx.render.template('<a href="{{testing this.url}}">linky</a>', { url: 'linky.html' });
    ctx.assertHTML('<a href="linky.html">linky</a>');
    ctx.assertStableRerender();
  });

  spec('Attribute helpers take a hash', (ctx) => {
    ctx.register.helper('testing', (_, hash) => {
      return hash['path'];
    });

    ctx.render.template('<a href="{{testing path=this.url}}">linky</a>', { url: 'linky.html' });
    ctx.assertHTML('<a href="linky.html">linky</a>');
    ctx.assertStableRerender();
  });

  spec('Attributes containing multiple helpers are treated like a block', (ctx) => {
    ctx.register.helper('testing', (params) => {
      return params[0];
    });

    ctx.render.template(
      '<a href="http://{{this.foo}}/{{testing this.bar}}/{{testing "baz"}}">linky</a>',
      {
        foo: 'foo.com',
        bar: 'bar',
      }
    );
    ctx.assertHTML('<a href="http://foo.com/bar/baz">linky</a>');
    ctx.assertStableRerender();
  });

  spec('Elements inside a yielded block', (ctx) => {
    ctx.render.template('{{#if true}}<div id="test">123</div>{{/if}}');
    ctx.assertHTML('<div id="test">123</div>');
    ctx.assertStableRerender();
  });

  spec('A simple block helper can return text', (ctx) => {
    ctx.render.template('{{#if true}}test{{else}}not shown{{/if}}');
    ctx.assertHTML('test');
    ctx.assertStableRerender();
  });
});

DynamicInitialRenderSuite.client();

const XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
