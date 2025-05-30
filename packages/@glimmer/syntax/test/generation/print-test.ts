import { preprocess as parse, print } from '@glimmer/syntax';

const { test } = QUnit;

let templates = [
  '<h1></h1>',
  '<h1 class="foo" id="title"></h1>',
  '<h1>Test</h1>',
  '<h1>{{model.title}}</h1>',
  '<h1>{{link-to "Foo" class="bar"}}</h1>',
  '<h1 class={{if foo "foo" "bar"}}>Test</h1>',
  '<h1 class={{color}}>Test</h1>',
  '<h1 class="{{if active "active" "inactive"}} foo">Test</h1>',
  '<p {{action "activate"}} {{someting foo="bar"}}>Test</p>',
  '<p>{{my-component submit=(action (mut model.name) (full-name model.firstName "Smith"))}}</p>',
  '<ul>{{#each foos as |foo index|}}\n  <li>{{foo}}: {{index}}</li>\n{{/each}}</ul>',
  '{{#if foo}}<p>{{foo}}</p>{{/if}}',
  '{{#if foo}}Foo{{else if bar}}Bar{{else}}Baz{{/if}}',
  '<Foo>{{bar}}</Foo>',
  '<Foo></Foo>',
  '<Foo />',
  '<Foo as |bar|>{{bar}}</Foo>',
  '{{#in-element this.someElement}}Content here{{/in-element}}',
  // components that *can* be void elements if lower-cased
  '<Area></Area>',
  '<Base></Base>',
  '<Br></Br>',
  '<Col></Col>',
  '<Command></Command>',
  '<Embed></Embed>',
  '<Hr></Hr>',
  '<Img></Img>',
  '<Input></Input>',
  '<Keygen></Keygen>',
  '<Link></Link>',
  '<Meta></Meta>',
  '<Param></Param>',
  '<Source></Source>',
  '<Track></Track>',
  '<Wbr></Wbr>',

  // void elements
  '<br>',
  '<br />',
  '<input disabled>',
  '<input disabled />',
  '<link>',

  // block-less components that *can* be void elements if lower-cased
  '<Area />',
  '<Base />',
  '<Br />',
  '<Col />',
  '<Command />',
  '<Embed />',
  '<Hr />',
  '<Img />',
  '<Input />',
  '<Keygen />',
  '<Link />',
  '<Meta />',
  '<Param />',
  '<Source />',
  '<Track />',
  '<Wbr />',

  // comments
  '<!-- foo -->',
  '<div {{!-- foo --}}></div>',
  '<div>{{!-- foo bar --}}<b></b></div>',
  '{{!-- {{foo-bar}} --}}',

  // literals
  '<Panel @arg={{"Foo"}}></Panel>',
  '<Panel @arg={{true}}></Panel>',
  '<Panel @arg={{5}}></Panel>',
  '{{panel arg="Foo"}}',
  '{{panel arg=true}}',
  '{{panel arg=5}}',

  // nested tags with indent
  '<div>\n  <p>Test</p>\n</div>',

  // attributes escaping
  '<h1 class="foo" id="title" data-a="&quot;Foo&nbsp;&amp;&nbsp;Bar&quot;"></h1>',
  '<h1 class="< &nbsp; {{if x "&" "<"}} &amp; &quot;">Test</h1>',
  '{{foo-bar placeholder="Choose a \\"thing\\""}}',

  // slash in path
  '{{namespace/foo "bar" baz="qux"}}',

  // unescaped
  '{{{unescaped}}}',

  // Comment in Angle Bracket component
  '<Foo {{!-- This is a comment --}} attribute></Foo>',

  // Empty string literal: arguments use ="" while attributes are valueless
  `<Hello @world="" data-foo />`,
];

QUnit.module('[glimmer-syntax] Code generation', () => {
  function printTransform(template: string) {
    return print(parse(template));
  }

  templates.forEach((template) => {
    test(`${template} is stable when printed`, (assert) => {
      assert.strictEqual(printTransform(template), template);
    });
  });

  test('TextNode: chars escape - but do not match', (assert) => {
    assert.strictEqual(
      printTransform('&lt; &amp; &nbsp; &gt; &copy;2018'),
      '&lt; &amp; &nbsp; &gt; ©2018'
    );
  });

  test('Handlebars comment', (assert) => {
    assert.strictEqual(printTransform('{{! foo }}'), '{{!-- foo --}}');
  });
});

QUnit.module('[glimmer-syntax] Code generation - source -> source', () => {
  function printTransform(template: string) {
    let ast = parse(template, {
      mode: 'codemod',
      parseOptions: { ignoreStandalone: true },
    });

    return print(ast, { entityEncoding: 'raw' });
  }

  function buildTest(template: string) {
    test(`${template} is stable when printed`, (assert) => {
      assert.strictEqual(printTransform(template), template);
    });
  }

  templates.forEach(buildTest);

  [
    // custom HTML Entities
    '&lt; &amp; &nbsp; &gt; &copy;2018',

    // whitespace control
    '\n{{~var~}}  ',
    '\n{{~#foo-bar~}} {{~else if x~}} {{~else~}} {{~/foo-bar~}}  ',

    // newlines after opening block
    '{{#each}}\n  <li> foo </li>\n{{/each}}',

    // "stand alone"
    ' {{#foo}}\n  {{bar}}\n {{/foo}}',

    `<span class="stampFont" style="font-family: 'stampfont'">&#xf000;</span>`,

    // preserves single quoting when it avoids introducing &quot;
    `<div class='He said "yes"'></div>`,
  ].forEach(buildTest);

  test('falls back to using entity encoding when necessary for correctness', (assert) => {
    let ast = parse(`<div class='transform-target'></div>`, {
      mode: 'codemod',
      parseOptions: { ignoreStandalone: true },
      plugins: {
        ast: [
          function (_env) {
            return {
              name: 'test',
              visitor: {
                TextNode(x) {
                  if (x.chars === 'transform-target') {
                    x.chars = 'He said "can\'t"';
                  }
                },
              },
            };
          },
        ],
      },
    });

    assert.strictEqual(
      print(ast, { entityEncoding: 'raw' }),
      `<div class="He said &quot;can't&quot;"></div>`
    );
  });
});

QUnit.module('[glimmer-syntax] Code generation - override', () => {
  test('can provide a custom options.override to be used', (assert) => {
    let ast = parse(`<FooBar @baz="qux" @derp="qux" />`);

    let actual = print(ast, {
      entityEncoding: 'transformed',

      override(ast) {
        if (ast.type === 'AttrNode' && ast.name === '@baz') {
          return '@baz="ZOMG!!!!"';
        }

        return;
      },
    });

    assert.strictEqual(actual, `<FooBar @baz="ZOMG!!!!" @derp="qux" />`);
  });

  test('maintains proper spacing when overriding hash', (assert) => {
    let ast = parse(`{{foo-bar blah=baz}}`);

    let actual = print(ast, {
      entityEncoding: 'transformed',

      override(ast) {
        if (ast.type === 'Hash') {
          return 'baz="ZOMG!!!!"';
        }

        return;
      },
    });

    assert.strictEqual(actual, `{{foo-bar baz="ZOMG!!!!"}}`);
  });

  test('maintains proper spacing when overriding empty hash', (assert) => {
    let ast = parse(`{{foo-bar derp blah=baz}}`);

    let actual = print(ast, {
      entityEncoding: 'transformed',

      override(ast) {
        if (ast.type === 'Hash') {
          return '';
        }

        return;
      },
    });

    assert.strictEqual(actual, `{{foo-bar derp}}`);
  });
});
