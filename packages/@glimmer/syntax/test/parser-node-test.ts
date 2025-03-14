import type { Dict } from '@glimmer/interfaces';
import type { ASTv1 } from '@glimmer/syntax';
import { builders as b, preprocess as parse } from '@glimmer/syntax';
import { PackageSuite, verifying } from '@glimmer-workspace/integration-tests';

import { astEqual } from './support';

const { test } = QUnit;

QUnit.module('[glimmer-syntax] Parser - AST');

const syntax = PackageSuite('@glimmer/syntax');

test('a simple piece of content', () => {
  let t = 'some content';
  astEqual(t, b.template([b.text('some content')]));
});

test('self-closed element', () => {
  let t = '<g />';
  astEqual(t, b.template([element('g/')]));
});

test('various html element paths', () => {
  const cases = [
    [`<Foo />`, b.fullPath(b.var('Foo'))],
    [`<Foo.bar.baz />`, b.fullPath(b.var('Foo'), ['bar', 'baz'])],
    [`<this />`, b.fullPath(b.this())],
    [`<this.foo.bar />`, b.fullPath(b.this(), ['foo', 'bar'])],
    [`<@Foo />`, b.fullPath(b.at('@Foo'))],
    [`<@Foo.bar.baz />`, b.fullPath(b.at('@Foo'), ['bar', 'baz'])],
    [`<:foo />`, b.fullPath(b.var(':foo'))],
  ] satisfies Array<[string, ASTv1.PathExpression]>;

  for (const [t, path] of cases) {
    astEqual(t, b.template([b.element({ path, selfClosing: true })]));
  }
});

test('elements can have empty attributes', () => {
  let t = '<img id="">';
  astEqual(t, b.template([element('img', ['attrs', ['id', '']])]));
});

syntax(['HTML Syntax'], (module) => {
  module.test('disallowed quote in element space is rejected', () => {
    verifying(`<img foo='bar'' >`, `' is not a valid character within attribute names`).throws`
      1 | <img foo='bar'' >
        |               =
        |               \===== invalid character
    `.errors();
  });

  module.test('disallowed equals sign in element space is rejected', () => {
    verifying(`<img =foo >`, `attribute name cannot start with equals sign`).throws`
      1 | <img =foo >
        |      =
        |      \===== invalid character
    `.errors();
  });
});

syntax(['Valid Handlebars invalid in Glimmer'], (module) => {
  module.test('path expression with "dangling dot" throws error', () => {
    verifying(
      '{{if foo. bar baz}}',
      "'.' is not a supported path in Glimmer; check for a path with a trailing '.'"
    ).throws`
      1 | {{if foo. bar baz}}
        |         =
        |         \===== invalid path
    `.errors();
  });

  module.test('string literal as path throws error', () => {
    verifying('{{("foo-baz")}}').throws`
      SyntaxError: \`foo-baz\` cannot be called. Consider replacing \`("foo-baz")\` with \`"foo-baz"\` if you meant to use it as a value
      1 | {{("foo-baz")}}
        |   -=========-
        |     \== string is not callable
    `.errors();
  });

  module.test('boolean literal as path throws error', () => {
    verifying('{{(true)}}').throws`
      SyntaxError: \`true\` cannot be called. Consider replacing \`(true)\` with \`true\` if you meant to use it as a value
      1 | {{(true)}}
        |   -====-
        |     \== boolean is not callable
    `.errors();
  });

  module.test('undefined literal as path throws error', () => {
    verifying('{{(undefined)}}').throws`
      SyntaxError: \`undefined\` cannot be called. Consider replacing \`(undefined)\` with \`undefined\` if you meant to use it as a value
      1 | {{(undefined)}}
        |   -=========-
        |     \== undefined is not callable
    `.errors();
  });

  module.test('null literal as path throws error', () => {
    verifying('{{(null)}}').throws`
      SyntaxError: \`null\` cannot be called. Consider replacing \`(null)\` with \`null\` if you meant to use it as a value
      1 | {{(null)}}
        |   -====-
        |     \== null is not callable
    `.errors();
  });

  module.test('number literal as path throws error', () => {
    verifying('{{(42)}}').throws`
      SyntaxError: \`42\` cannot be called. Consider replacing \`(42)\` with \`42\` if you meant to use it as a value
      1 | {{(42)}}
        |   -==-
        |     \== number is not callable
    `.errors();
  });
});

test('svg content', () => {
  let t = '<svg></svg>';
  astEqual(t, b.template([element('svg')]));
});

test('html content with html content inline', () => {
  let t = '<div><p></p></div>';
  astEqual(t, b.template([element('div', ['body', element('p')])]));
});

test('html content with svg content inline', () => {
  let t = '<div><svg></svg></div>';
  astEqual(t, b.template([element('div', ['body', element('svg')])]));
});

let integrationPoints = ['foreignObject', 'desc'];
function buildIntegrationPointTest(integrationPoint: string) {
  return function integrationPointTest() {
    let t = '<svg><' + integrationPoint + '><div></div></' + integrationPoint + '></svg>';
    astEqual(
      t,
      b.template([element('svg', ['body', element(integrationPoint, ['body', element('div')])])])
    );
  };
}

for (const integrationPoint of integrationPoints) {
  test(
    'svg content with html content inline for ' + integrationPoint,
    buildIntegrationPointTest(integrationPoint)
  );
}

test('svg title with html content', () => {
  let t = '<svg><title><div></div></title></svg>';
  astEqual(
    t,
    b.template([element('svg', ['body', element('title', ['body', b.text('<div></div>')])])])
  );
});

test('a piece of content with HTML', () => {
  let t = 'some <div>content</div> done';
  astEqual(
    t,
    b.template([b.text('some '), element('div', ['body', b.text('content')]), b.text(' done')])
  );
});

test('a piece of Handlebars with HTML', () => {
  let t = 'some <div>{{content}}</div> done';
  astEqual(
    t,
    b.template([
      b.text('some '),
      element('div', ['body', b.mustache(b.path('content'))]),
      b.text(' done'),
    ])
  );
});

syntax(['Invalid HTML Syntax'], (module) => {
  module.test('...attributes is not allowed as values', () => {
    verifying('{{...attributes}}', 'Invalid use of ...attributes').throws`
      1 | {{...attributes}}
        |   =============
        |         \====== invalid content
    `.errors();
  });

  module.test('...attributes is not allowed as modifiers', () => {
    verifying('<div {{...attributes}}></div>', 'Invalid use of ...attributes').throws`
      1 | <div {{...attributes}}></div>
        |        =============
        |         \====== invalid modifier
    `.errors();
  });

  module.test('...attributes is not allowed as attribute values', () => {
    verifying('<div class={{...attributes}}></div>', 'Invalid use of ...attributes').throws`
      1 | <div class={{...attributes}}></div>
        |              =============
        |                \====== invalid attribute value
    `.errors();
  });

  module.test('Awkward mustache in unquoted attribute value', () => {
    verifying('<div class=a{{foo}}></div>', 'Invalid dynamic value in an unquoted attribute')
      .throws`
      1 | <div class=a{{foo}}></div>
        |            -=======
        |                \====== invalid dynamic value
        |            \---------- missing quotes
    `.errors();

    verifying('<div class=a{{foo}}b></div>', 'Invalid dynamic value in an unquoted attribute')
      .throws`
    1 | <div class=a{{foo}}b></div>
      |            -=======-
      |                \====== invalid dynamic value
      |            \---------- missing quotes
  `.errors();

    verifying('<div class={{foo}}b></div>', 'Invalid dynamic value in an unquoted attribute')
      .throws`
        1 | <div class={{foo}}b></div>
          |            =======-
          |                   \--- missing quotes
          |                \====== invalid dynamic value
      `.errors();
  });

  module.test('a Handlebars comment in invalid element space', () => {
    verifying(
      `\nbefore <div \n  a{{! some comment }} data-foo="bar"></div> after`,
      'Invalid comment in an opening tag'
    ).throws`
      3 |   a{{! some comment }} data-foo="bar"></div> after
        |    ===================
        |     \================== invalid comment
    `.errors();

    verifying(
      `\nbefore <div \n  a={{! some comment }} data-foo="bar"></div> after`,
      'Invalid comment in an attribute'
    ).throws`
      3 |   a={{! some comment }} data-foo="bar"></div> after
        |     ===================
        |      \================== invalid comment
    `.errors();

    verifying(
      '\nbefore <div \n  a="{{! some comment }}" data-foo="bar"></div> after',
      'Invalid comment in a quoted attribute'
    ).throws`
      3 |   a="{{! some comment }}" data-foo="bar"></div> after
        |      ===================
        |        \================== invalid comment
    `.errors();

    verifying(
      `\nbefore <div \n  a='{{! some comment }}' data-foo="bar"></div> after`,
      'Invalid comment in a quoted attribute'
    ).throws`
      3 |   a='{{! some comment }}' data-foo="bar"></div> after
        |      ===================
        |        \================== invalid comment
    `.errors();
  });

  module.test('disallowed mustaches in the tagName space', () => {
    verifying(`<{{'asdf'}}></{{'asdf'}}>`).throws`
      SyntaxError: Invalid dynamic tag name
      1 | <{{'asdf'}}></{{'asdf'}}>
        |  --======--
        |     \======= dynamic value
    `.throws`
      SyntaxError: Invalid dynamic closing tag name
      1 | <{{'asdf'}}></{{'asdf'}}>
        |               --======--
        |                   \======= dynamic value
    `.errors();
  });
});

test('Handlebars embedded in an attribute (quoted)', () => {
  let t = 'some <div class="{{foo}}">content</div> done';
  astEqual(
    t,
    b.template([
      b.text('some '),
      element(
        'div',
        ['attrs', ['class', b.concat([b.mustache('foo')])]],
        ['body', b.text('content')]
      ),
      b.text(' done'),
    ])
  );
});

test('Handlebars embedded in an attribute (unquoted)', () => {
  let t = 'some <div class={{foo}}>content</div> done';
  astEqual(
    t,
    b.template([
      b.text('some '),
      element('div', ['attrs', ['class', b.mustache(b.path('foo'))]], ['body', b.text('content')]),
      b.text(' done'),
    ])
  );
});

test('Handlebars embedded in an attribute of a self-closing tag (unqouted)', () => {
  let t = '<input value={{foo}}/>';

  let el = element('input/', ['attrs', ['value', b.mustache(b.path('foo'))]]);
  astEqual(t, b.template([el]));
});

test('Handlebars embedded in an attribute (sexprs)', () => {
  let t = 'some <div class="{{foo (foo "abc")}}">content</div> done';
  astEqual(
    t,
    b.template([
      b.text('some '),
      element(
        'div',
        [
          'attrs',
          [
            'class',
            b.concat([b.mustache(b.path('foo'), [b.sexpr(b.path('foo'), [b.string('abc')])])]),
          ],
        ],
        ['body', b.text('content')]
      ),
      b.text(' done'),
    ])
  );
});

test('Handlebars embedded in an attribute with other content surrounding it', () => {
  let t = 'some <a href="http://{{link}}/">content</a> done';
  astEqual(
    t,
    b.template([
      b.text('some '),
      element(
        'a',
        ['attrs', ['href', b.concat([b.text('http://'), b.mustache('link'), b.text('/')])]],
        ['body', b.text('content')]
      ),
      b.text(' done'),
    ])
  );
});

test('A more complete embedding example', () => {
  let t =
    "{{embed}} {{some 'content'}} " +
    "<div class='{{foo}} {{bind-class isEnabled truthy='enabled'}}'>{{ content }}</div>" +
    " {{more 'embed'}}";
  astEqual(
    t,
    b.template([
      b.mustache(b.path('embed')),
      b.text(' '),
      b.mustache(b.path('some'), [b.string('content')]),
      b.text(' '),
      element(
        'div',
        [
          'attrs',
          [
            'class',
            b.concat([
              b.mustache('foo'),
              b.text(' '),
              b.mustache(
                'bind-class',
                [b.path('isEnabled')],
                b.hash([b.pair('truthy', b.string('enabled'))])
              ),
            ]),
          ],
        ],
        ['body', b.mustache(b.path('content'))]
      ),
      b.text(' '),
      b.mustache(b.path('more'), [b.string('embed')]),
    ])
  );
});

test('Simple embedded block helpers', () => {
  let t = '{{#if foo}}<div>{{content}}</div>{{/if}}';
  astEqual(
    t,
    b.template([
      b.block(
        b.path('if'),
        [b.path('foo')],
        b.hash(),
        b.blockItself([element('div', ['body', b.mustache(b.path('content'))])])
      ),
    ])
  );
});

test('Involved block helper', () => {
  let t =
    '<p>hi</p> content {{#testing shouldRender}}<p>Appears!</p>{{/testing}} more <em>content</em> here';
  astEqual(
    t,
    b.template([
      element('p', ['body', b.text('hi')]),
      b.text(' content '),
      b.block(
        b.path('testing'),
        [b.path('shouldRender')],
        b.hash(),
        b.blockItself([element('p', ['body', b.text('Appears!')])])
      ),
      b.text(' more '),
      element('em', ['body', b.text('content')]),
      b.text(' here'),
    ])
  );
});

test('block with block params', () => {
  let t = `{{#foo as |bar bat baz|}}{{bar}} {{bat}} {{baz}}{{/foo}}`;

  astEqual(
    t,
    b.template([
      b.block(
        b.path('foo'),
        null,
        null,
        b.blockItself(
          [b.mustache('bar'), b.text(' '), b.mustache('bat'), b.text(' '), b.mustache('baz')],
          ['bar', 'bat', 'baz']
        )
      ),
    ])
  );
});

test('block with block params edge case: extra spaces', () => {
  let t = `{{#foo as | bar bat baz |}}{{bar}} {{bat}} {{baz}}{{/foo}}`;

  astEqual(
    t,
    b.template([
      b.block(
        b.path('foo'),
        null,
        null,
        b.blockItself(
          [b.mustache('bar'), b.text(' '), b.mustache('bat'), b.text(' '), b.mustache('baz')],
          ['bar', 'bat', 'baz']
        )
      ),
    ])
  );
});

test('block with block params edge case: multiline', () => {
  let t = `{{#foo as
|bar bat
      b
a
      z|}}{{bar}} {{bat}} {{baz}}{{/foo}}`;

  astEqual(
    t,
    b.template([
      b.block(
        b.path('foo'),
        null,
        null,
        b.blockItself(
          [b.mustache('bar'), b.text(' '), b.mustache('bat'), b.text(' '), b.mustache('baz')],
          ['bar', 'bat', 'b', 'a', 'z']
        )
      ),
    ])
  );
});

test('block with block params edge case: block-params like params', () => {
  let t = `{{#foo "as |a b c|" as |bar bat baz|}}{{bar}} {{bat}} {{baz}}{{/foo}}`;

  astEqual(
    t,
    b.template([
      b.block(
        b.path('foo'),
        [b.string('as |a b c|')],
        null,
        b.blockItself(
          [b.mustache('bar'), b.text(' '), b.mustache('bat'), b.text(' '), b.mustache('baz')],
          ['bar', 'bat', 'baz']
        )
      ),
    ])
  );
});

test('block with block params edge case: block-params like content', () => {
  let t = `{{#foo as |bar bat baz|}}as |a b c|{{/foo}}`;

  astEqual(
    t,
    b.template([
      b.block(
        b.path('foo'),
        null,
        null,
        b.blockItself([b.text('as |a b c|')], ['bar', 'bat', 'baz'])
      ),
    ])
  );
});

test('element with block params', () => {
  let t = `<Foo as |bar bat baz|>{{bar}} {{bat}} {{baz}}</Foo>`;

  astEqual(
    t,
    b.template([
      element(
        'Foo',
        ['as', b.var('bar'), b.var('bat'), b.var('baz')],
        ['body', b.mustache('bar'), b.text(' '), b.mustache('bat'), b.text(' '), b.mustache('baz')]
      ),
    ])
  );
});

test('element with block params edge case: extra spaces', () => {
  let t = `<Foo as | bar bat baz |>{{bar}} {{bat}} {{baz}}</Foo>`;

  astEqual(
    t,
    b.template([
      element(
        'Foo',
        ['as', b.var('bar'), b.var('bat'), b.var('baz')],
        ['body', b.mustache('bar'), b.text(' '), b.mustache('bat'), b.text(' '), b.mustache('baz')]
      ),
    ])
  );
});

test('element with block params edge case: multiline', () => {
  let t = `<Foo as
|bar bat
      b
a
      z|>{{bar}} {{bat}} {{baz}}</Foo>`;

  astEqual(
    t,
    b.template([
      element(
        'Foo',
        ['as', b.var('bar'), b.var('bat'), b.var('b'), b.var('a'), b.var('z')],
        ['body', b.mustache('bar'), b.text(' '), b.mustache('bat'), b.text(' '), b.mustache('baz')]
      ),
    ])
  );
});

test('element with block params edge case: block-params like attribute names', () => {
  let t = `<Foo as="a" async="b" as |bar bat baz|>as |a b c|</Foo>`;

  astEqual(
    t,
    b.template([
      element(
        'Foo',
        ['attrs', ['as', 'a'], ['async', 'b']],
        ['as', b.var('bar'), b.var('bat'), b.var('baz')],
        ['body', b.text('as |a b c|')]
      ),
    ])
  );
});

test('element with block params edge case: block-params like attribute values', () => {
  let t = `<Foo foo="as |a b c|" as |bar bat baz|>{{bar}} {{bat}} {{baz}}</Foo>`;

  astEqual(
    t,
    b.template([
      element(
        'Foo',
        ['attrs', ['foo', 'as |a b c|']],
        ['as', b.var('bar'), b.var('bat'), b.var('baz')],
        ['body', b.mustache('bar'), b.text(' '), b.mustache('bat'), b.text(' '), b.mustache('baz')]
      ),
    ])
  );
});

test('element with block params edge case: block-params like content', () => {
  let t = `<Foo as |bar bat baz|>as |a b c|</Foo>`;

  astEqual(
    t,
    b.template([
      element(
        'Foo',
        ['as', b.var('bar'), b.var('bat'), b.var('baz')],
        ['body', b.text('as |a b c|')]
      ),
    ])
  );
});

test('Element modifiers', () => {
  let t = "<p {{action 'boom'}} class='bar'>Some content</p>";
  astEqual(
    t,
    b.template([
      element(
        'p',
        ['attrs', ['class', 'bar']],
        ['modifiers', ['action', [b.string('boom')]]],
        ['body', b.text('Some content')]
      ),
    ])
  );
});

test('Tokenizer: MustacheStatement encountered in beforeAttributeName state', () => {
  let t = '<input {{bar}}>';
  astEqual(t, b.template([element('input', ['modifiers', 'bar'])]));
});

test('Tokenizer: MustacheStatement encountered in attributeName state', () => {
  let t = '<input foo{{bar}}>';
  astEqual(t, b.template([element('input', ['attrs', ['foo', '']], ['modifiers', ['bar']])]));
});

test('Tokenizer: MustacheStatement encountered in afterAttributeName state', () => {
  let t = '<input foo {{bar}}>';
  astEqual(t, b.template([element('input', ['attrs', ['foo', '']], ['modifiers', 'bar'])]));
});

test('Tokenizer: MustacheStatement encountered in afterAttributeValue state', () => {
  let t = '<input foo=1 {{bar}}>';
  astEqual(t, b.template([element('input', ['attrs', ['foo', '1']], ['modifiers', ['bar']])]));
});

test('Tokenizer: MustacheStatement encountered in afterAttributeValueQuoted state', () => {
  let t = "<input foo='1'{{bar}}>";
  astEqual(t, b.template([element('input', ['attrs', ['foo', '1']], ['modifiers', 'bar'])]));
});

test('Stripping - mustaches', () => {
  let t = 'foo {{~content}} bar';
  astEqual(
    t,
    b.template([
      b.text('foo'),
      b.mustache(b.path('content'), undefined, undefined, undefined, undefined, {
        open: true,
        close: false,
      }),
      b.text(' bar'),
    ])
  );

  t = 'foo {{content~}} bar';
  astEqual(
    t,
    b.template([
      b.text('foo '),
      b.mustache(b.path('content'), undefined, undefined, undefined, undefined, {
        open: false,
        close: true,
      }),
      b.text('bar'),
    ])
  );
});

test('Stripping - blocks', () => {
  let t = 'foo {{~#wat}}{{/wat}} bar';
  astEqual(
    t,
    b.template([
      b.text('foo'),
      b.block(b.path('wat'), [], b.hash(), b.blockItself(), undefined, undefined, {
        open: true,
        close: false,
      }),
      b.text(' bar'),
    ])
  );

  t = 'foo {{#wat}}{{/wat~}} bar';
  astEqual(
    t,
    b.template([
      b.text('foo '),
      b.block(
        b.path('wat'),
        [],
        b.hash(),
        b.blockItself(),
        undefined,
        undefined,
        undefined,
        undefined,
        { open: false, close: true }
      ),
      b.text('bar'),
    ])
  );
});

test('Stripping - programs', () => {
  let t = '{{#wat~}} foo {{else}}{{/wat}}';
  astEqual(
    t,
    b.template([
      b.block(
        b.path('wat'),
        [],
        b.hash(),
        b.blockItself([b.text('foo ')]),
        b.blockItself(),
        undefined,
        { open: false, close: true }
      ),
    ])
  );

  t = '{{#wat}} foo {{~else}}{{/wat}}';
  astEqual(
    t,
    b.template([
      b.block(
        b.path('wat'),
        [],
        b.hash(),
        b.blockItself([b.text(' foo')]),
        b.blockItself(),
        undefined,
        undefined,
        { open: true, close: false }
      ),
    ])
  );

  t = '{{#wat}}{{else~}} foo {{/wat}}';
  astEqual(
    t,
    b.template([
      b.block(
        b.path('wat'),
        [],
        b.hash(),
        b.blockItself(),
        b.blockItself([b.text('foo ')]),
        undefined,
        undefined,
        { open: false, close: true }
      ),
    ])
  );

  t = '{{#wat}}{{else}} foo {{~/wat}}';
  astEqual(
    t,
    b.template([
      b.block(
        b.path('wat'),
        [],
        b.hash(),
        b.blockItself(),
        b.blockItself([b.text(' foo')]),
        undefined,
        undefined,
        undefined,
        { open: true, close: false }
      ),
    ])
  );
});

test('Stripping - removes unnecessary text nodes', () => {
  let t = '{{#each~}}\n  <li> foo </li>\n{{~/each}}';

  astEqual(
    t,
    b.template([
      b.block(
        b.path('each'),
        [],
        b.hash(),
        b.blockItself([element('li', ['body', b.text(' foo ')])]),
        null,
        undefined,
        { open: false, close: true },
        undefined,
        { open: true, close: false }
      ),
    ])
  );
});

test('Whitespace control - linebreaks after blocks removed by default', () => {
  let t = '{{#each}}\n  <li> foo </li>\n{{/each}}';

  astEqual(
    t,
    b.template([
      b.block(
        b.path('each'),
        [],
        b.hash(),
        b.blockItself([b.text('  '), element('li', ['body', b.text(' foo ')]), b.text('\n')]),
        null
      ),
    ])
  );
});

test('Whitespace control - preserve all whitespace if config is set', () => {
  let t = '{{#each}}\n  <li> foo </li>\n{{/each}}';

  astEqual(
    t,
    b.template([
      b.block(
        b.path('each'),
        [],
        b.hash(),
        b.blockItself([b.text('\n  '), element('li', ['body', b.text(' foo ')]), b.text('\n')]),
        null
      ),
    ]),
    undefined,
    {
      parseOptions: { ignoreStandalone: true },
    }
  );
});

test('an HTML comment', () => {
  let t = 'before <!-- some comment --> after';
  astEqual(t, b.template([b.text('before '), b.comment(' some comment '), b.text(' after')]));
});

test('a Handlebars comment inside an HTML comment', () => {
  let t = 'before <!-- some {{! nested thing }} comment --> after';
  astEqual(
    t,
    b.template([
      b.text('before '),
      b.comment(' some {{! nested thing }} comment '),
      b.text(' after'),
    ])
  );
});

test('a Handlebars comment', () => {
  let t = 'before {{! some comment }} after';
  astEqual(
    t,
    b.template([b.text('before '), b.mustacheComment(' some comment '), b.text(' after')])
  );
});

test('a Handlebars comment with whitespace removal', function () {
  let t = 'before {{~! some comment ~}} after';
  astEqual(t, b.program([b.text('before'), b.mustacheComment(' some comment '), b.text('after')]));
});

test('a Handlebars comment in proper element space', () => {
  let t = 'before <div {{! some comment }} data-foo="bar" {{! other comment }}></div> after';
  astEqual(
    t,
    b.template([
      b.text('before '),
      element(
        'div',
        ['attrs', ['data-foo', b.text('bar')]],
        ['comments', b.mustacheComment(' some comment '), b.mustacheComment(' other comment ')]
      ),
      b.text(' after'),
    ])
  );
});

test('a Handlebars comment after a valueless attribute', () => {
  let t = '<input foo {{! comment }}>';
  astEqual(
    t,
    b.template([
      element('input', ['attrs', ['foo', '']], ['comments', b.mustacheComment(' comment ')]),
    ])
  );
});

test('allow {{null}} to be passed as helper name', () => {
  let ast = parse('{{null}}');

  astEqual(ast, b.template([b.mustache(b.null())]));
});

test('allow {{null}} to be passed as a param', () => {
  let ast = parse('{{foo null}}');

  astEqual(ast, b.template([b.mustache(b.path('foo'), [b.null()])]));
});

test('allow {{undefined}} to be passed as helper name', () => {
  let ast = parse('{{undefined}}');

  astEqual(ast, b.template([b.mustache(b.undefined())]));
});

test('allow {{undefined}} to be passed as a param', () => {
  let ast = parse('{{foo undefined}}');

  astEqual(ast, b.template([b.mustache(b.path('foo'), [b.undefined()])]));
});

syntax(['Invalid Handlebars syntax'], (module) => {
  module.test('Handlebars partial should error', () => {
    verifying(`{{> foo}}`, `Handlebars partials are not supported`).throws`
      1 | {{> foo}}
        | =========
        |   \====== invalid partial
    `.errors();
  });

  module.test('Handlebars partial blocks should error', () => {
    verifying('{{#> foo}}{{/foo}}', 'Handlebars partial blocks are not supported').throws`
      1 | {{#> foo}}{{/foo}}
        | ==================
        |   \======= invalid partial block
    `.errors();
  });

  module.test('Handlebars decorators should error', () => {
    verifying('{{* foo}}', 'Handlebars decorators are not supported').throws`
      1 | {{* foo}}
        | =========
        |   \====== invalid decorator
    `.errors();
  });

  module.test('Handlebars decorator blocks should error', () => {
    verifying('{{#* foo}}{{/foo}}', 'Handlebars decorator blocks are not supported').throws`
      1 | {{#* foo}}{{/foo}}
        | ==================
        |   \======= invalid decorator block
    `.errors();
  });
});

test('mustache immediately followed by self closing tag does not error', () => {
  let ast = parse('<FooBar data-foo={{blah}}/>');
  let el = element('FooBar/', ['attrs', ['data-foo', b.mustache('blah')]]);
  astEqual(ast, b.template([el]));
});

QUnit.dump.maxDepth = 100;

test('named blocks', () => {
  let ast = parse(strip`
    <Tab>
      <:header>
        It's a header!
      </:header>

      <:body as |contents|>
        <div>{{contents}}</div>
      </:body>
    </Tab>
  `);

  let el = element('Tab', [
    'body',
    element(':header', ['body', b.text(`It's a header!`)]),
    element(
      ':body',
      ['body', element('div', ['body', b.mustache('contents')])],
      ['as', b.var('contents')]
    ),
  ]);
  astEqual(ast, b.template([el]));
});

export function strip(strings: TemplateStringsArray, ...args: string[]) {
  return strings
    .map((str: string, i: number) => {
      return `${str
        .split('\n')
        .map((s) => s.trim())
        .join('')}${args[i] ? args[i] : ''}`;
    })
    .join('');
}

export type ElementParts =
  | ['attrs', ...AttrSexp[]]
  | ['modifiers', ...ModifierSexp[]]
  | ['body', ...ASTv1.Statement[]]
  | ['comments', ...ASTv1.MustacheCommentStatement[]]
  | ['as', ...ASTv1.VarHead[]]
  | ['loc', ASTv1.SourceLocation];

export type PathSexp = string | ['path', string, LocSexp?];

export type ModifierSexp =
  | string
  | [PathSexp, LocSexp?]
  | [PathSexp, ASTv1.Expression[], LocSexp?]
  | [PathSexp, ASTv1.Expression[], Dict<ASTv1.Expression>, LocSexp?];

export type AttrSexp = [string, ASTv1.AttrNode['value'] | string, LocSexp?];

export type LocSexp = ['loc', ASTv1.SourceLocation];

export type SexpValue =
  | string
  | ASTv1.Expression[]
  | Dict<ASTv1.Expression>
  | LocSexp
  | PathSexp
  | undefined;

export type BuildElementParams = Parameters<typeof b.element>;
export type TagDescriptor = BuildElementParams[0];
export type BuildElementOptions = NonNullable<BuildElementParams[1]>;

export function element(tag: TagDescriptor, ...options: ElementParts[]): ASTv1.ElementNode {
  return b.element(tag, normalizeElementParts(...options));
}

export function normalizeElementParts(...args: ElementParts[]): BuildElementOptions {
  let out: BuildElementOptions = {};

  for (let arg of args) {
    switch (arg[0]) {
      case 'attrs': {
        let [, ...rest] = arg;
        out.attrs = rest.map(normalizeAttr);
        break;
      }
      case 'modifiers': {
        let [, ...rest] = arg;
        out.modifiers = rest.map(normalizeModifier);
        break;
      }
      case 'body': {
        let [, ...rest] = arg;
        out.children = rest;
        break;
      }
      case 'comments': {
        let [, ...rest] = arg;

        out.comments = rest;
        break;
      }
      case 'as': {
        let [, ...rest] = arg;
        out.blockParams = rest;
        break;
      }
      case 'loc': {
        let [, rest] = arg;
        out.loc = rest;
        break;
      }
    }
  }

  return out;
}

export function normalizeAttr(sexp: AttrSexp): ASTv1.AttrNode {
  let name = sexp[0];
  let value;

  if (typeof sexp[1] === 'string') {
    value = b.text(sexp[1]);
  } else {
    value = sexp[1];
  }

  return b.attr(name, value);
}

export function normalizeModifier(sexp: ModifierSexp): ASTv1.ElementModifierStatement {
  if (typeof sexp === 'string') {
    return b.elementModifier(sexp);
  }

  let path: ASTv1.Expression = normalizeHead(sexp[0]);
  let params: ASTv1.Expression[] | undefined;
  let hash: ASTv1.Hash | undefined;
  let loc: ASTv1.SourceLocation | null = null;

  let parts = sexp.slice(1);
  let next = parts.shift();

  _process: {
    if (isParamsSexp(next)) {
      params = next;
    } else {
      break _process;
    }

    next = parts.shift();

    if (isHashSexp(next)) {
      hash = normalizeHash(next);
    } else {
      break _process;
    }
  }

  if (isLocSexp(next)) {
    loc = next[1];
  }

  return b.elementModifier(path as ASTv1.CallableExpression, params, hash, b.loc(loc || null));
}

export function normalizeHead(path: PathSexp): ASTv1.Expression {
  if (typeof path === 'string') {
    return b.path(path);
  } else {
    return b.path(path[1], path[2] && path[2][1]);
  }
}

export function normalizeHash(
  hash: Dict<ASTv1.Expression>,
  loc?: ASTv1.SourceLocation
): ASTv1.Hash {
  let pairs = Object.entries(hash).map(([key, value]) => b.pair(key, value));

  return b.hash(pairs, loc);
}

export function isParamsSexp(value: SexpValue): value is ASTv1.Expression[] {
  return Array.isArray(value) && !isLocSexp(value);
}

export function isLocSexp(value: SexpValue): value is LocSexp {
  return Array.isArray(value) && value.length === 2 && value[0] === 'loc';
}

export function isHashSexp(value: SexpValue): value is Dict<ASTv1.Expression> {
  if (typeof value === 'object' && !Array.isArray(value)) {
    expectType<Dict<ASTv1.Expression>>(value);
    return true;
  } else {
    return false;
  }
}

function expectType<T>(_input: T): void {
  return;
}
