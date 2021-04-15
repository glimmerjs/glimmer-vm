import { preprocess as parse, print, traverse } from '../..';

function decodeHTML(str: string) {
  return str.replace(/&#([0-9]+);/g, function (_, int) {
    return String.fromCharCode(parseInt(int, 10));
  });
}

const { test } = QUnit;

function escapedHTMLtoNormalHTML(html: string) {
  const escapedAST = parse(html);
  let content = '';
  traverse(escapedAST, {
    TextNode(node, path) {
      if (path.parent && path.parent.node.type === 'AttrNode') {
        return;
      }
      content += node.chars;
    },
  });
  const extractedHTML = decodeHTML(content);
  return print(parse(extractedHTML));
}

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

  // void elements
  '<br>',
  '<br />',
  '<input disabled>',
  '<input disabled />',

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
];

QUnit.module('[glimmer-syntax] Code generation', function () {
  function printTransform(template: string) {
    return escapedHTMLtoNormalHTML(
      print(parse(template), { entityEncoding: 'transformed', outputEncoding: 'html' })
    );
  }

  templates.forEach((template) => {
    test(`${template} is stable when printed`, function (assert) {
      assert.equal(printTransform(template), template);
    });
  });

  test('TextNode: chars escape - but do not match', (assert) => {
    assert.equal(
      printTransform('&lt; &amp; &nbsp; &gt; &copy;2018'),
      '&lt; &amp; &nbsp; &gt; ©2018'
    );
  });

  test('Handlebars comment', (assert) => {
    assert.equal(printTransform('{{! foo }}'), '{{!-- foo --}}');
  });
});
