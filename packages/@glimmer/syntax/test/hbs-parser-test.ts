import {
  hbsParse as parse,
  hbsPrint as print,
  hbs,
  locForSpan,
  AstBuilder,
  BuilderAst,
  builder as b,
} from '@glimmer/syntax';
import { JsonValue, JsonArray } from '@glimmer/interfaces';
import { keys } from '@glimmer/util';

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

function equals<T>(actual: T, expected: T) {
  QUnit.assert.equal(actual, expected);
}

function equiv<T>(actual: T, expected: T) {
  QUnit.assert.deepEqual(actual, expected);
}

function equivAST(template: string, { ast, sexp }: { ast?: BuilderAst; sexp?: JsonArray }) {
  let parsed = parse(template);

  QUnit.assert.ok(parsed.errors.length === 0, `there were no parse errors in '${template}'`);

  if (ast) {
    QUnit.assert.deepEqual(parsed.result, new AstBuilder().build(ast));
  }

  if (sexp) {
    QUnit.assert.deepEqual(print(parsed.result), ['concat', sexp]);
  }
}

function it(name: string, callback: () => void) {
  QUnit.test(name, callback);
}

function todo(name: string, callback: () => void) {
  QUnit.todo(name, callback);
}

function legacy(name: string, callback: () => void) {
  QUnit.skip(`[not-glimmer] ${name}`, callback);
}

function shouldThrow(callback: () => void, error: typeof Error, pattern?: RegExp) {
  QUnit.assert.raises(callback, error, pattern);
}

const VALUES = {
  baz: 'baz',
  true: '%true%',
  false: '%false%',
  null: '%null%',
  undefined: '%undefined%',
  '@baz': '@baz',
};

/**
 * Notational conventions for strings inside of sexps:
 *
 * s:... (string)
 * @... (named arg)
 * bare (local arg)
 */

describe('@glimmer/syntax - parser', function() {
  function astFor(template: string | hbs.AnyProgram): JsonValue {
    let ast = parse(template);
    QUnit.assert.ok(ast.errors.length === 0, 'there were no parse errors');
    return print(ast.result);
  }

  it('parses content', () => {
    equivAST('hello', { sexp: ['s:hello'] });
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
    equivAST('{{ 123 }}', { sexp: [123] });
    equivAST('{{ "foo" }}', { sexp: ['s:foo'] });
    equivAST('{{ false }}', { sexp: ['%false%'] });
    equivAST('{{ true }}', { sexp: ['%true%'] });
    equivAST('{{ foo }}', { sexp: ['foo'] });
    equivAST('{{ foo? }}', { sexp: ['foo?'] });
    equivAST('{{ foo_ }}', { sexp: ['foo_'] });
    equivAST('{{ foo- }}', { sexp: ['foo-'] });
    equivAST('{{ foo: }}', { sexp: ['foo:'] });
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

    equivAST('{{ foo.bar.baz }}', { sexp: [['get-path', 'foo', 's:bar', 's:baz']] });
  });

  it('parses mustaches with this/foo (`/` is just a valid identifier character, so `this` is not special', function() {
    equivAST('{{this/foo}}', { sexp: ['this/foo'] });
  });

  it('parses mustaches with this.foo', function() {
    equivAST('{{this.foo}}', { sexp: [['get-path', '%this%', 's:foo']] });
  });

  it('parses mustaches with - in a path', function() {
    equivAST('{{foo-bar}}', { sexp: ['foo-bar'] });
  });

  todo('parses mustaches with escaped [] in a path', function() {
    equals(astFor('{{[foo[\\]]}}'), '{{ /"foo[]"/ [] }}\n');
  });

  todo('parses escaped \\\\ in path', function() {
    equals(astFor('{{[foo\\\\]}}'), '{{ /"foo\\"/ [] }}\n');
  });

  it('parses mustaches with parameters', function() {
    equivAST('{{foo bar}}', { sexp: [['foo', 'bar']] });
  });

  it('parses mustaches with string parameters', function() {
    equivAST('{{foo bar "baz" }}', { sexp: [['foo', 'bar', 's:baz']] });
  });

  it('parses mustaches with NUMBER parameters', function() {
    equivAST('{{foo 1}}', { sexp: [['foo', 1]] });
  });

  it('parses mustaches with BOOLEAN parameters', function() {
    equivAST('{{foo true}}', { sexp: [['foo', '%true%']] });
    equivAST('{{foo false}}', { sexp: [['foo', '%false%']] });
  });

  it('parses mustaches with undefined and null paths', function() {
    equivAST('{{undefined}}', { sexp: ['%undefined%'] });
    equivAST('{{null}}', { sexp: ['%null%'] });
  });

  it('parses mustaches with undefined and null parameters', function() {
    equivAST('{{foo undefined null}}', { sexp: [['foo', '%undefined%', '%null%']] });
  });

  it('parses mustaches with DATA parameters', function() {
    equivAST('{{foo @bar}}', { sexp: [['foo', '@bar']] });
  });

  it('parses mustaches with hash arguments', function() {
    for (let key of keys(VALUES)) {
      equivAST(`{{foo bar=${key}}}`, { sexp: [['foo', { bar: VALUES[key] }]] });
    }

    for (let key of keys(VALUES)) {
      equivAST(`{{foo bar=${key} baz=${key}}}`, {
        sexp: [['foo', { bar: VALUES[key], baz: VALUES[key] }]],
      });
    }

    for (let key of keys(VALUES)) {
      equivAST(`{{foo bar bar=${key} baz=${key}}}`, {
        sexp: [['foo', 'bar', { bar: VALUES[key], baz: VALUES[key] }]],
      });
    }
  });

  it('parses contents followed by a mustache', function() {
    equivAST('foo bar {{baz}}', { sexp: ['s:foo bar ', 'baz'] });
    // equals(astFor('foo bar {{baz}}'), `CONTENT[ 'foo bar ' ]\n{{ /"baz"/ [] }}\n`);
  });

  legacy('parses a partial', function() {
    equals(astFor('{{> foo }}'), '{{> PARTIAL:foo }}\n');
    equals(astFor('{{> "foo" }}'), '{{> PARTIAL:foo }}\n');
    equals(astFor('{{> 1 }}'), '{{> PARTIAL:1 }}\n');
  });

  legacy('parses a partial with context', function() {
    equals(astFor('{{> foo bar}}'), '{{> PARTIAL:foo /"bar"/ }}\n');
  });

  legacy('parses a partial with hash', function() {
    equals(astFor('{{> foo bar=bat}}'), '{{> PARTIAL:foo HASH{bar=/"bat"/} }}\n');
  });

  legacy('parses a partial with context and hash', function() {
    equals(astFor('{{> foo bar bat=baz}}'), '{{> PARTIAL:foo /"bar"/ HASH{bat=/"baz"/} }}\n');
  });

  legacy('parses a partial with a complex name', function() {
    equals(astFor('{{> shared/partial?.bar}}'), '{{> PARTIAL:shared/partial?.bar }}\n');
  });

  legacy('parsers partial blocks', function() {
    equals(
      astFor('{{#> foo}}bar{{/foo}}'),
      "{{> PARTIAL BLOCK:foo PROGRAM:\n  CONTENT[ 'bar' ]\n }}\n"
    );
  });

  legacy('should handle parser block mismatch', function() {
    shouldThrow(
      function() {
        astFor('{{#> goodbyes}}{{/hellos}}');
      },
      Error,
      /goodbyes doesn't match hellos/
    );
  });

  legacy('parsers partial blocks with arguments', function() {
    equals(
      astFor('{{#> foo context hash=value}}bar{{/foo}}'),
      `{{> PARTIAL BLOCK:foo /"context"/ HASH{hash=/"value"/} PROGRAM:\n  CONTENT[ 'bar' ]\n }}\n`
    );
  });

  it('parses a comment', function() {
    equivAST('{{! this is a comment }}', { sexp: [['comment', ' this is a comment ']] });
  });

  it('parses a multi-line comment', function() {
    equivAST('{{!\nthis is a multi-line comment\n}}', {
      sexp: [['comment', '\nthis is a multi-line comment\n']],
    });
  });

  legacy('parses an inverse section', function() {
    equals(
      astFor('{{#foo}} bar {{^}} baz {{/foo}}'),
      `BLOCK:\n  /"foo"/ []\n  PROGRAM:\n    CONTENT[ ' bar ' ]\n  {{^}}\n    CONTENT[ ' baz ' ]\n`
    );
  });

  it('parses an inverse (else-style) section', function() {
    equivAST('{{#foo}} bar {{else}} baz {{/foo}}', {
      sexp: [['block', 'foo', { default: ['s: bar '], else: ['s: baz '] }]],
    });
  });

  it('parses multiple inverse sections', function() {
    equivAST('{{#foo}} bar {{else if bar}}{{else}} baz {{/foo}}', {
      sexp: [
        [
          'block',
          'foo',
          {
            default: ['s: bar '],
            else: [['block', 'if', 'bar', { default: [], else: ['s: baz '] }]],
          },
        ],
      ],
    });
  });

  it('parses empty blocks', function() {
    equivAST('{{#foo}}{{/foo}}', { sexp: [['block', 'foo', { default: [] }]] });
  });

  it('parses blocks', function() {
    equivAST('{{#foo}}hello {{world}} goodbye{{/foo}}', {
      sexp: [['block', 'foo', { default: ['s:hello ', 'world', 's: goodbye'] }]],
    });
  });

  legacy('parses empty blocks with empty inverse section', function() {
    equals(astFor('{{#foo}}{{^}}{{/foo}}'), '{{# /"foo"/ [] }}\n  PROGRAM:\n  {{else}}\n');
  });

  it('parses empty blocks with empty inverse (else-style) section', function() {
    equivAST('{{#foo}}{{else}}{{/foo}}', { sexp: [['block', 'foo', { default: [], else: [] }]] });
  });

  legacy('parses non-empty blocks with empty inverse section', function() {
    equals(
      astFor('{{#foo}} bar {{^}}{{/foo}}'),
      `BLOCK:\n  /"foo"/ []\n  PROGRAM:\n    CONTENT[ ' bar ' ]\n  {{^}}\n`
    );
  });

  it('parses non-empty blocks with empty inverse (else-style) section', function() {
    equivAST('{{#foo}} bar {{else}}{{/foo}}', {
      sexp: [['block', 'foo', { default: ['s: bar '], else: [] }]],
    });
  });

  legacy('parses empty blocks with non-empty inverse section', function() {
    equals(
      astFor('{{#foo}}{{^}} bar {{/foo}}'),
      `BLOCK:\n  /"foo"/ []\n  PROGRAM:\n  {{^}}\n    CONTENT[ ' bar ' ]\n`
    );
  });

  it('parses empty blocks with non-empty inverse (else-style) section', function() {
    equivAST('{{#foo}}{{else}} bar {{/foo}}', {
      sexp: [['block', 'foo', { default: [], else: ['s: bar '] }]],
    });
  });

  legacy('parses a standalone inverse section', function() {
    equals(astFor('{{^foo}}bar{{/foo}}'), `BLOCK:\n  /"foo"/ []\n  {{^}}\n    CONTENT[ 'bar' ]\n`);
  });

  it('throws on old inverse section', function() {
    shouldThrow(function() {
      astFor('{{else foo}}bar{{/foo}}');
    }, Error);
  });

  it('parses block with block params', function() {
    equivAST('{{#foo as |bar baz|}}content{{/foo}}', {
      ast: b.ast(
        b.blockCall(b.path('foo'), {
          program: b.block({
            statements: [b.content('content')],
            as: ['bar', 'baz'],
          }),
        })
      ),
      sexp: [['block', 'foo', { as: ['bar', 'baz'] }, { default: ['s:content'] }]],
    });
  });

  legacy('parses inverse block with block params', function() {
    equals(
      astFor('{{^foo as |bar baz|}}content{{/foo}}'),
      `BLOCK:\n  /"foo"/ []\n  {{^}}\n    BLOCK PARAMS: [ bar baz ]\n    CONTENT[ 'content' ]\n`
    );
  });

  todo('parses chained inverse block with block params', function() {
    equals(
      astFor('{{#foo}}{{else foo as |bar baz|}}content{{/foo}}'),
      `{{# /"foo"/ [] }}\n  PROGRAM:\n  {{else}}\n    {{# /"foo"/ [] as |bar baz| }}\n      PROGRAM:\n        CONTENT[ 'content' ]\n`
    );
  });

  todo("raises if there's a Parse error", function() {
    shouldThrow(
      function() {
        astFor('foo{{^}}bar');
      },
      Error,
      /Parse error on line 1/
    );
    shouldThrow(
      function() {
        astFor('{{foo}');
      },
      Error,
      /Parse error on line 1/
    );
    shouldThrow(
      function() {
        astFor('{{foo &}}');
      },
      Error,
      /Parse error on line 1/
    );
    shouldThrow(
      function() {
        astFor('{{#goodbyes}}{{/hellos}}');
      },
      Error,
      /goodbyes doesn't match hellos/
    );

    shouldThrow(
      function() {
        astFor('{{{{goodbyes}}}} {{{{/hellos}}}}');
      },
      Error,
      /goodbyes doesn't match hellos/
    );
  });

  todo('should handle invalid paths', function() {
    shouldThrow(
      function() {
        astFor('{{foo/../bar}}');
      },
      Error,
      /Invalid path: foo\/\.\. - 1:2/
    );
    shouldThrow(
      function() {
        astFor('{{foo/./bar}}');
      },
      Error,
      /Invalid path: foo\/\. - 1:2/
    );
    shouldThrow(
      function() {
        astFor('{{foo/this/bar}}');
      },
      Error,
      /Invalid path: foo\/this - 1:2/
    );
  });

  todo('knows how to report the correct line number in errors', function() {
    shouldThrow(
      function() {
        astFor('hello\nmy\n{{foo}');
      },
      Error,
      /Parse error on line 3/
    );
    shouldThrow(
      function() {
        astFor('hello\n\nmy\n\n{{foo}');
      },
      Error,
      /Parse error on line 5/
    );
  });

  todo(
    'knows how to report the correct line number in errors when the first character is a newline',
    function() {
      shouldThrow(
        function() {
          astFor('\n\nhello\n\nmy\n\n{{foo}');
        },
        Error,
        /Parse error on line 7/
      );
    }
  );

  describe('externally compiled AST', function() {
    it('can pass through an already-compiled AST', function() {
      equals(print(parse(parse('{{Hello}}').result).result), "CONTENT[ 'Hello' ]\n");
    });
  });

  describe('[not-glimmer] directives', function() {
    legacy('should parse block directives', function() {
      equals(astFor('{{#* foo}}{{/foo}}'), 'DIRECTIVE BLOCK:\n  /"foo"/ []\n  PROGRAM:\n');
    });
    legacy('should parse directives', function() {
      equals(astFor('{{* foo}}'), '{{ DIRECTIVE /"foo"/ [] }}\n');
    });
    legacy('should fail if directives have inverse', function() {
      shouldThrow(
        function() {
          astFor('{{#* foo}}{{^}}{{/foo}}');
        },
        Error,
        /Unexpected inverse/
      );
    });
  });

  it('GH1024 - should track program location properly', function() {
    let source =
      '\n' +
      '  {{#if foo}}\n' +
      '    {{bar}}\n' +
      '       {{else}}    {{baz}}\n' +
      '\n' +
      '     {{/if}}\n' +
      '    ';

    let p = parse(source).result;

    // We really need a deep equals but for now this should be stable...
    equals(
      JSON.stringify(locForSpan(source, p.span)),
      JSON.stringify({
        start: { line: 1, column: 0 },
        end: { line: 7, column: 4 },
      })
    );

    equals(
      JSON.stringify(locForSpan(source, (p.body[1] as hbs.BlockStatement).program.span)),
      JSON.stringify({
        start: { line: 2, column: 13 },
        end: { line: 4, column: 7 },
      })
    );
    equals(
      JSON.stringify(locForSpan(source, (p.body[1] as hbs.BlockStatement).inverse!.span)),
      JSON.stringify({
        start: { line: 4, column: 15 },
        end: { line: 6, column: 5 },
      })
    );
  });
});
