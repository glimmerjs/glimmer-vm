import { JsonArray } from '@glimmer/interfaces';
import {
  AstBuilder,
  builder as b,
  BuilderAst,
  hbsParse as parse,
  hbsPrint as print,
} from '@glimmer/syntax';
import { BuilderMustache } from '../lib/hbs/builder';

const MODULE_STACK: string[] = [];

function describe(name: string, callback: () => void) {
  MODULE_STACK.push(name);
  currentModule();

  try {
    callback();
  } finally {
    MODULE_STACK.pop();
    currentModule();
  }
}

function currentModule() {
  if (MODULE_STACK.length === 0) {
    return;
  }

  let last = MODULE_STACK[MODULE_STACK.length - 1];

  QUnit.module(last);
}

// function equals<T>(actual: T, expected: T) {
//   QUnit.assert.equal(actual, expected);
// }

// function equiv<T>(actual: T, expected: T) {
//   QUnit.assert.deepEqual(actual, expected);
// }

function equivAST(
  template: string,
  { ast, sexp }: { ast?: BuilderAst | BuilderMustache; sexp?: JsonArray }
) {
  let parsed = parse(template);

  QUnit.assert.ok(
    parsed.errors.length === 0,
    `there were no parse errors in '${JSON.stringify(template)}'`
  );

  if (ast) {
    let build = ast.type === 'MustacheStatement' ? b.ast(ast) : ast;
    QUnit.assert.deepEqual(parsed.result, new AstBuilder().build(build), 'ast matches');
  }

  if (sexp) {
    QUnit.assert.deepEqual(print(parsed.result), ['concat', sexp], 'sexp matches');
  }
}

function it(name: string, callback: () => void) {
  QUnit.test(name, callback);
}

// function todo(name: string, callback: () => void) {
//   QUnit.todo(name, callback);
// }

// function shouldThrow(callback: () => void, error: typeof Error, pattern?: RegExp) {
//   QUnit.assert.raises(callback, error, pattern);
// }

const VALUES = new Map<string | boolean | null | undefined, string>([
  ['baz', 'baz'],
  [true, '%true%'],
  [false, '%false%'],
  [null, '%null%'],
  [undefined, '%undefined%'],
  ['@baz', '@baz'],
]);

// const VALUES = {
//   baz: 'baz',
//   true: '%true%',
//   false: '%false%',
//   null: '%null%',
//   undefined: '%undefined%',
//   '@baz': '@baz',
// };

/**
 * Notational conventions for strings inside of sexps:
 *
 * s:... (string)
 * @... (named arg)
 * bare (local arg)
 */

describe('@glimmer/syntax - parser', function() {
  it('parses any empty program', () => {
    equivAST('', { sexp: [], ast: b.ast() });
  });

  it('parses content', () => {
    equivAST('hello', { sexp: ['s:hello'], ast: b.ast(b.content('hello')) });
  });

  it('parses comments', () => {
    equivAST('{{! hello }}', {
      sexp: [['comment', ' hello ']],
      ast: b.ast(b.comment(' hello ')),
    });

    equivAST('{{!-- hello --}}', {
      sexp: [['comment', ' hello ']],
      ast: b.ast(b.comment('-- hello --')),
    });
  });

  it('strips whitespace around comments', () => {
    equivAST(`{{! hello }}\nworld\n{{! goodbye }}\n`, {
      sexp: [['comment', ' hello '], 's:world\n', ['comment', ' goodbye ']],
      ast: b.ast(
        b.comment(' hello '),
        b.skip(),
        b.content('world\n'),
        b.comment(' goodbye '),
        b.skip()
      ),
    });

    equivAST(`{{! hello }}   \nworld\n   {{! goodbye }}   \n`, {
      sexp: [['comment', ' hello '], 's:world\n', ['comment', ' goodbye ']],
      ast: b.ast(
        b.comment(' hello '),
        b.skip('   \n'),
        b.content('world\n'),
        b.skip('   '),
        b.comment(' goodbye '),
        b.skip('   \n')
      ),
    });
  });

  it('parses simple mustaches', function() {
    equivAST('{{123}}', { ast: b.ast(b.mustache(b.literal(123))), sexp: [123] });
    equivAST('{{"foo"}}', {
      ast: b.ast(b.mustache(b.literal('foo'))),
      sexp: ['s:foo'],
    });
    equivAST('{{true}}', {
      ast: b.ast(b.mustache(b.literal(true))),
      sexp: ['%true%'],
    });
    equivAST('{{false}}', {
      ast: b.ast(b.mustache(b.literal(false))),
      sexp: ['%false%'],
    });

    let idents = ['foo', 'foo?', 'foo_', 'foo:', 'foo/bar'];

    for (let item of idents) {
      equivAST(`{{${item}}}`, {
        ast: b.ast(b.mustache(b.path(item))),
        sexp: [item],
      });
    }
  });

  it('parses simple mustaches (whitespace)', function() {
    equivAST('{{ 123 }}', { sexp: [123], ast: b.mustache(b.ws(), 123, b.ws()) });
    equivAST('{{ "foo" }}', { sexp: ['s:foo'], ast: b.mustache(b.ws(), b.literal('foo'), b.ws()) });
    equivAST('{{ false }}', {
      sexp: ['%false%'],
      ast: b.mustache(b.ws(), b.literal(false), b.ws()),
    });
    equivAST('{{ true }}', { sexp: ['%true%'], ast: b.mustache(b.ws(), b.literal(true), b.ws()) });
    equivAST('{{ foo }}', { sexp: ['foo'], ast: b.mustache(b.ws(), 'foo', b.ws()) });
    equivAST('{{ foo? }}', { sexp: ['foo?'], ast: b.mustache(b.ws(), 'foo?', b.ws()) });
    equivAST('{{ foo_ }}', { sexp: ['foo_'], ast: b.mustache(b.ws(), 'foo_', b.ws()) });
    equivAST('{{ foo- }}', { sexp: ['foo-'], ast: b.mustache(b.ws(), 'foo-', b.ws()) });
    equivAST('{{ foo: }}', { sexp: ['foo:'], ast: b.mustache(b.ws(), 'foo:', b.ws()) });
  });

  it('parses mustaches with data', function() {
    equivAST('{{@foo}}', {
      ast: b.ast(b.mustache(b.atPath('foo'))),
      sexp: ['@foo'],
    });
    equivAST('{{@foo.bar}}', {
      ast: b.ast(b.mustache(b.atPath('foo.bar'))),
      sexp: [['get-path', '@foo', 's:bar']],
    });
  });

  it('parses mustaches with paths', function() {
    equivAST('{{foo.bar}}', {
      sexp: [['get-path', 'foo', 's:bar']],
      ast: b.ast(b.mustache(b.path('foo.bar'))),
    });
    equivAST('{{foo.bar.baz}}', {
      sexp: [['get-path', 'foo', 's:bar', 's:baz']],
      ast: b.ast(b.mustache(b.path('foo.bar.baz'))),
    });

    equivAST('{{ foo.bar }}', {
      sexp: [['get-path', 'foo', 's:bar']],
      ast: b.ast(b.mustache(b.ws(), b.path('foo.bar'), b.ws())),
    });

    equivAST('{{ foo.bar.baz }}', {
      sexp: [['get-path', 'foo', 's:bar', 's:baz']],
      ast: b.ast(b.mustache(b.ws(), b.path('foo.bar.baz'), b.ws())),
    });
  });

  it('parses mustaches with this-prefixed paths', function() {
    equivAST('{{this.foo.bar}}', {
      sexp: [['get-path', '%this%', 's:foo', 's:bar']],
      ast: b.ast(b.mustache(b.path('this.foo.bar'))),
    });
    equivAST('{{this.foo.bar.baz}}', {
      sexp: [['get-path', '%this%', 's:foo', 's:bar', 's:baz']],
      ast: b.ast(b.mustache(b.path('this.foo.bar.baz'))),
    });

    equivAST('{{ this.foo.bar }}', {
      sexp: [['get-path', '%this%', 's:foo', 's:bar']],
      ast: b.ast(b.mustache(b.ws(), b.path('this.foo.bar'), b.ws())),
    });

    equivAST('{{ this.foo.bar.baz }}', {
      sexp: [['get-path', '%this%', 's:foo', 's:bar', 's:baz']],
      ast: b.ast(b.mustache(b.ws(), b.path('this.foo.bar.baz'), b.ws())),
    });
  });

  it('parses mustaches with this/foo (`/` is just a valid identifier character, so `this` is not special', function() {
    equivAST('{{this/foo}}', { sexp: ['this/foo'], ast: b.ast(b.mustache(b.path('this/foo'))) });
  });

  it('parses mustaches with this.foo', function() {
    equivAST('{{this.foo}}', {
      sexp: [['get-path', '%this%', 's:foo']],
      ast: b.ast(b.mustache(b.path('this.foo'))),
    });
  });

  it('parses mustaches with - in a path', function() {
    equivAST('{{foo-bar}}', { sexp: ['foo-bar'], ast: b.ast(b.mustache(b.path('foo-bar'))) });
  });

  // todo('parses mustaches with escaped [] in a path', function() {
  //   equals(astFor('{{[foo[\\]]}}'), '{{ /"foo[]"/ [] }}\n');
  // });

  // todo('parses escaped \\\\ in path', function() {
  //   equals(astFor('{{[foo\\\\]}}'), '{{ /"foo\\"/ [] }}\n');
  // });

  // it('parses mustaches with parameters', function() {
  //   equivAST('{{foo bar}}', {
  //     sexp: [['foo', 'bar']],
  //     ast: b.ast(b.mustache(b.path('foo'), b.path('bar'))),
  //   });
  // });

  it('parses mustaches with string parameters', function() {
    equivAST('{{foo bar "baz"}}', {
      sexp: [['foo', 'bar', 's:baz']],
      ast: b.ast(b.mustache(b.path('foo'), b.path('bar'), b.literal('baz'))),
    });

    equivAST('{{foo  bar  "baz" }}', {
      sexp: [['foo', 'bar', 's:baz']],
      ast: b.ast(
        b.mustache(b.path('foo'), b.ws('  '), b.path('bar'), b.ws('  '), b.literal('baz'), b.ws())
      ),
    });
  });

  it('parses mustaches with NUMBER parameters', function() {
    equivAST('{{foo 1}}', {
      sexp: [['foo', 1]],
      ast: b.mustache('foo', 1),
    });
  });

  it('parses mustaches with BOOLEAN parameters', function() {
    equivAST('{{foo true}}', {
      sexp: [['foo', '%true%']],
      ast: b.ast(b.mustache(b.path('foo'), b.literal(true))),
    });
    equivAST('{{foo false}}', {
      sexp: [['foo', '%false%']],
      ast: b.mustache('foo', false),
    });
  });

  it('parses mustaches with undefined and null paths', function() {
    equivAST('{{undefined}}', {
      sexp: ['%undefined%'],
      ast: b.mustache(undefined),
    });
    equivAST('{{null}}', { sexp: ['%null%'], ast: b.mustache(null) });
  });

  it('parses mustaches with undefined and null parameters', function() {
    equivAST('{{foo undefined null}}', {
      sexp: [['foo', '%undefined%', '%null%']],
      ast: b.mustache('foo', undefined, null),
    });
  });

  it('parses mustaches with DATA parameters', function() {
    equivAST('{{foo @bar}}', { sexp: [['foo', '@bar']], ast: b.mustache('foo', '@bar') });
  });

  it('parses mustaches with hash arguments', function() {
    for (let key of VALUES.keys()) {
      equivAST(`{{foo bar=${key}}}`, {
        sexp: [['foo', { bar: VALUES.get(key)! }]],
        ast: b.mustache('foo', b.hash({ bar: key })),
      });
    }

    for (let key of VALUES.keys()) {
      equivAST(`{{foo bar=${key} baz=${key}}}`, {
        sexp: [['foo', { bar: VALUES.get(key)!, baz: VALUES.get(key)! }]],
      });
    }

    for (let key of VALUES.keys()) {
      equivAST(`{{foo bar bar=${key} baz=${key}}}`, {
        sexp: [['foo', 'bar', { bar: VALUES.get(key)!, baz: VALUES.get(key)! }]],
      });
    }
  });

  it('parses contents followed by a mustache', function() {
    equivAST('foo bar {{baz}}', {
      sexp: ['s:foo bar ', 'baz'],
      ast: b.ast(b.content('foo bar '), b.mustache('baz')),
    });
  });

  it('parses a comment', function() {
    equivAST('{{! this is a comment }}', {
      sexp: [['comment', ' this is a comment ']],
      ast: b.ast(b.comment(' this is a comment ')),
    });
  });

  it('parses a multi-line comment', function() {
    equivAST('{{!\nthis is a multi-line comment\n}}', {
      sexp: [['comment', '\nthis is a multi-line comment\n']],
      ast: b.ast(b.comment('\nthis is a multi-line comment\n')),
    });
  });

  it('parses a block comment', function() {
    equivAST('{{!-- this is a comment --}}', {
      sexp: [['comment', ' this is a comment ']],
      ast: b.ast(b.comment('-- this is a comment --')),
    });
  });

  it('parses empty blocks', function() {
    equivAST('{{#foo}}{{/foo}}', {
      sexp: [['block', [['foo']]]],
      ast: b.ast(b.blockCall(['foo'], b.block())),
    });

    equivAST('{{#foo}}\n{{/foo}}\n', {
      sexp: [['block', [['foo']]]],
      ast: b.ast(b.blockCall(['foo'], b.skip(), b.block()), b.skip()),
    });

    equivAST('{{#foo}}  \n  {{/foo}}\n', {
      sexp: [['block', [['foo']]]],
      ast: b.ast(b.blockCall(['foo'], b.skip('  \n'), b.block(), b.skip('  ')), b.skip()),
    });
  });

  it('parses blocks', function() {
    equivAST('{{#foo}}hello {{world}} goodbye{{/foo}}', {
      sexp: [['block', [['foo'], 's:hello ', 'world', 's: goodbye']]],
      ast: b.ast(
        b.blockCall(
          ['foo'],
          b.block(b.content('hello '), b.mustache('world'), b.content(' goodbye'))
        )
      ),
    });

    equivAST('{{#foo}}  \nhello\n{{world}}\ngoodbye\n  {{/foo}}', {
      sexp: [['block', [['foo'], 's:hello\n', 'world', 's:\ngoodbye\n']]],
      ast: b.ast(
        b.blockCall(
          ['foo'],
          b.skip('  \n'),
          b.block(b.content('hello\n'), b.mustache('world'), b.content('\ngoodbye\n')),
          b.skip('  ')
        )
      ),
    });
  });

  it('parses an inverse (else-style) section', function() {
    equivAST('{{#foo}} bar {{else}} baz {{/foo}}', {
      sexp: [['block', [['foo'], 's: bar '], [[], 's: baz ']]],
      ast: b.ast(
        b.blockCall(['foo'], b.block(b.content(' bar ')), b.inverse([], b.content(' baz ')))
      ),
    });
  });

  it('parses an inverse (else-style) section with whitespace', function() {
    equivAST('{{#foo}}\n  bar\n{{else}}\n  baz\n{{/foo}}', {
      sexp: [['block', [['foo'], 's:  bar\n'], [[], 's:  baz\n']]],
      ast: b.ast(
        b.blockCall(
          ['foo'],
          b.block(b.skip(), b.content('  bar\n')),
          b.inverse([], b.skip(), b.content('  baz\n'))
        )
      ),
    });

    equivAST('{{#foo}}\n  bar\n  {{else}}  \n  baz\n{{/foo}}', {
      sexp: [['block', [['foo'], 's:  bar\n'], [[], 's:  baz\n']]],
      ast: b.ast(
        b.blockCall(
          ['foo'],
          b.block(b.skip(), b.content('  bar\n')),
          b.skip('  '),
          b.inverse([], b.skip('  \n'), b.content('  baz\n'))
        )
      ),
    });
  });

  it('parses strangely nested content (edge-cases)', () => {
    let source = [
      '',
      '  {{#if foo}}',
      '    {{#if bar}}',
      '        test',
      '        {{else}}',
      '      test',
      '  {{/if    }}',
      '       {{/if',
      '      }}',
      '    ',
    ].join('\n');

    equivAST(source, {
      sexp: [
        's:\n',
        [
          'block',
          [['if', 'foo'], ['block', [['if', 'bar'], 's:        test\n'], [[], 's:      test\n']]],
        ],
        's:    ',
      ],
      ast: b.ast(
        b.content('\n'),
        b.skip('  '),
        b.blockCall(
          ['if', 'foo'],
          b.skip('\n    '),
          b.block(
            b.blockCall(
              ['if', 'bar'],
              b.skip(),
              b.block(b.content('        test\n')),
              b.skip('        '),
              b.inverse([], b.skip(), b.content('      test\n'), b.skip('  ')),
              b.close('if', b.ws('    '))
            )
          ),
          b.skip('\n       '),
          b.close('if', b.ws('\n      '))
        ),
        b.skip('\n'),
        b.content('    ')
      ),
    });
  });

  it('parses multiple inverse sections', function() {
    equivAST('{{#foo}} bar {{else if bar}}{{else}} baz {{/foo}}', {
      sexp: [['block', [['foo'], 's: bar '], [['if', 'bar']], [[], 's: baz ']]],
    });
  });

  // it('parses empty blocks with empty inverse (else-style) section', function() {
  //   equivAST('{{#foo}}{{else}}{{/foo}}', { sexp: [['block', 'foo', { default: [], else: [] }]] });
  // });

  // it('parses non-empty blocks with empty inverse (else-style) section', function() {
  //   equivAST('{{#foo}} bar {{else}}{{/foo}}', {
  //     sexp: [['block', 'foo', { default: ['s: bar '], else: [] }]],
  //   });
  // });

  // it('parses empty blocks with non-empty inverse (else-style) section', function() {
  //   equivAST('{{#foo}}{{else}} bar {{/foo}}', {
  //     sexp: [['block', 'foo', { default: [], else: ['s: bar '] }]],
  //   });
  // });

  // it('throws on old inverse section', function() {
  //   shouldThrow(function() {
  //     astFor('{{else foo}}bar{{/foo}}');
  //   }, Error);
  // });

  // it('parses block with block params', function() {
  //   equivAST('{{#foo as |bar baz|}}content{{/foo}}', {
  //     ast: b.ast(
  //       b.blockCall('foo', {
  //         program: b.block({
  //           statements: [b.content('content')],
  //           as: ['bar', 'baz'],
  //         }),
  //       })
  //     ),
  //     sexp: [['block', 'foo', { as: ['bar', 'baz'] }, { default: ['s:content'] }]],
  //   });
  // });

  // it('handles escape chars before content', () => {
  //   equivAST(`hello \\<div>world</div>`, {
  //     sexp: ['s:hello \\<div>world</div>'],
  //   });
  // });

  // it('handles nested subexpressions', () => {
  //   equivAST(`<div>{{testing (testing "hello" foo) (testing (testing bar "lol") baz)}}</div>`, {
  //     sexp: [
  //       's:<div>',
  //       ['testing', ['testing', 's:hello', 'foo'], ['testing', ['testing', 'bar', 's:lol'], 'baz']],
  //       's:</div>',
  //     ],
  //   });
  // });

  // it('parses idiomatic each loop', () => {
  //   equivAST(`{{#each list key="@index" as |item|}}{{item}}{{else}}Empty{{/each}}`, {
  //     sexp: [
  //       [
  //         'block',
  //         'each',
  //         'list',
  //         { key: 's:@index' },
  //         { as: ['item'] },
  //         { default: ['item'], else: ['s:Empty'] },
  //       ],
  //     ],
  //     ast: b.ast(
  //       b.blockCall('each', {
  //         params: ['list'],
  //         hash: b.hash({ key: b.literal('@index') }),
  //         program: b.block({ as: ['item'], statements: [b.mustache('item')] }),
  //         inverse: b.block({ statements: [b.content('Empty')] }),
  //       })
  //     ),
  //   });
  // });

  // it('parses elaborate nested hash syntax', () => {
  //   equivAST(`{{#with (hash Foo=(component 'Foo')) as |Other|}}<Other.Foo />{{/with}}`, {
  //     sexp: [
  //       [
  //         'block',
  //         'with',
  //         ['hash', { Foo: ['component', 's:Foo'] }],
  //         { as: ['Other'] },
  //         { default: [`s:<Other.Foo />`] },
  //       ],
  //     ],

  //     ast: b.ast(
  //       b.blockCall('with', {
  //         params: [b.sexpr('hash', b.hash({ Foo: b.sexpr('component', b.literal('Foo')) }))],
  //         program: b.block({ statements: [b.content('<Other.Foo />')], as: ['Other'] }),
  //       })
  //     ),
  //   });
  // });

  // todo('parses chained inverse block with block params', function() {
  //   equals(
  //     astFor('{{#foo}}{{else foo as |bar baz|}}content{{/foo}}'),
  //     `{{# /"foo"/ [] }}\n  PROGRAM:\n  {{else}}\n    {{# /"foo"/ [] as |bar baz| }}\n      PROGRAM:\n        CONTENT[ 'content' ]\n`
  //   );
  // });

  // todo("raises if there's a Parse error", function() {
  //   shouldThrow(
  //     function() {
  //       astFor('foo{{^}}bar');
  //     },
  //     Error,
  //     /Parse error on line 1/
  //   );
  //   shouldThrow(
  //     function() {
  //       astFor('{{foo}');
  //     },
  //     Error,
  //     /Parse error on line 1/
  //   );
  //   shouldThrow(
  //     function() {
  //       astFor('{{foo &}}');
  //     },
  //     Error,
  //     /Parse error on line 1/
  //   );
  //   shouldThrow(
  //     function() {
  //       astFor('{{#goodbyes}}{{/hellos}}');
  //     },
  //     Error,
  //     /goodbyes doesn't match hellos/
  //   );

  //   shouldThrow(
  //     function() {
  //       astFor('{{{{goodbyes}}}} {{{{/hellos}}}}');
  //     },
  //     Error,
  //     /goodbyes doesn't match hellos/
  //   );
  // });

  // todo('should handle invalid paths', function() {
  //   shouldThrow(
  //     function() {
  //       astFor('{{foo/../bar}}');
  //     },
  //     Error,
  //     /Invalid path: foo\/\.\. - 1:2/
  //   );
  //   shouldThrow(
  //     function() {
  //       astFor('{{foo/./bar}}');
  //     },
  //     Error,
  //     /Invalid path: foo\/\. - 1:2/
  //   );
  //   shouldThrow(
  //     function() {
  //       astFor('{{foo/this/bar}}');
  //     },
  //     Error,
  //     /Invalid path: foo\/this - 1:2/
  //   );
  // });

  // todo('knows how to report the correct line number in errors', function() {
  //   shouldThrow(
  //     function() {
  //       astFor('hello\nmy\n{{foo}');
  //     },
  //     Error,
  //     /Parse error on line 3/
  //   );
  //   shouldThrow(
  //     function() {
  //       astFor('hello\n\nmy\n\n{{foo}');
  //     },
  //     Error,
  //     /Parse error on line 5/
  //   );
  // });

  // todo(
  //   'knows how to report the correct line number in errors when the first character is a newline',
  //   function() {
  //     shouldThrow(
  //       function() {
  //         astFor('\n\nhello\n\nmy\n\n{{foo}');
  //       },
  //       Error,
  //       /Parse error on line 7/
  //     );
  //   }
  // );

  // it('can pass through an already-compiled AST', function() {
  //   equiv(print(parse(parse('{{Hello}}').result).result), ['concat', ['Hello']]);
  // });

  // it('GH1024 - should track program location properly', function() {
  //   let source = [
  //     '',
  //     '  {{#if foo}}',
  //     '    {{bar}}',
  //     '       {{else}}    {{baz}}',
  //     '',
  //     '     {{/if}}',
  //     '    ',
  //   ].join('\n');
  //   let p = parse(source).result;

  //   // We really need a deep equals but for now this should be stable...
  //   equals(
  //     JSON.stringify(locForSpan(source, p.span)),
  //     JSON.stringify({
  //       start: { line: 1, column: 0 },
  //       end: { line: 7, column: 4 },
  //     })
  //   );

  //   equals(
  //     JSON.stringify(locForSpan(source, (p.body[1] as hbs.BlockStatement).program.span)),
  //     JSON.stringify({
  //       start: { line: 2, column: 13 },
  //       end: { line: 4, column: 7 },
  //     })
  //   );

  //   equals(
  //     JSON.stringify(locForSpan(source, (p.body[1] as hbs.BlockStatement).inverse!.span)),
  //     JSON.stringify({
  //       start: { line: 4, column: 15 },
  //       end: { line: 6, column: 5 },
  //     })
  //   );
  // });
});
