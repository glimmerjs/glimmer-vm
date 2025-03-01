import {
  highlightError,
  jitSuite,
  preprocess,
  RenderTest,
  syntaxErrorFor,
  test,
} from '@glimmer-workspace/integration-tests';

class SyntaxErrors extends RenderTest {
  static suiteName = 'general syntax errors';

  @test
  'context switching using ../ is not allowed'() {
    this.assert.throws(
      () => {
        preprocess('<div><p>{{../value}}</p></div>', { meta: { moduleName: 'test-module' } });
      },
      highlightError('Changing context using `../` is not supported in Glimmer')`
        1 | <div><p>{{../value}}</p></div>
          |           ==------
          |            \=== invalid \`..\` syntax
      `
    );
  }

  @test
  'mixing . and / is not allowed'() {
    this.assert.throws(
      () => {
        preprocess('<div><p>{{a/b.c}}</p></div>', { meta: { moduleName: 'test-module' } });
      },
      highlightError(
        'Mixing `.` and `/` in paths is not supported in Glimmer; use only `.` to separate property paths'
      )`
        1 | <div><p>{{a/b.c}}</p></div>
          |           =====
          |            \=== invalid mixed syntax
      `
    );
  }

  @test
  'explicit self ref with ./ is not allowed'() {
    this.assert.throws(
      () => {
        preprocess('<div><p>{{./value}}</p></div>', { meta: { moduleName: 'test-module' } });
      },
      highlightError('Using "./" is not supported in Glimmer and unnecessary')`
        1 | <div><p>{{./value}}</p></div>
          |           ==-----
          |             \==== invalid \`./\` syntax
      `
    );
  }

  @test
  'Block params in HTML syntax - requires a space between as and pipes'() {
    this.assert.throws(
      () => {
        preprocess('<x-bar as|foo|>foo</x-bar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError(
        'Invalid block parameters syntax: expecting at least one space character between "as" and "|"'
      )`
        1 | <x-bar as|foo|>foo</x-bar>
          |        -==
          |          \=== missing space
      `
    );
  }

  @test
  'Block params in HTML syntax - Throws exception if given zero parameters'() {
    this.assert.throws(
      () => {
        preprocess('<x-bar as ||>foo</x-bar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError(
        'Invalid block parameters syntax: empty block params, expecting at least one identifier'
      )`
        1 | <x-bar as ||>foo</x-bar>
          |        ---==
          |            \=== empty block params
      `
    );

    this.assert.throws(
      () => {
        preprocess('<x-bar as | |>foo</x-bar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError(
        'Invalid block parameters syntax: empty block params, expecting at least one identifier'
      )`
        1 | <x-bar as | |>foo</x-bar>
          |        ---===
          |             \=== empty block params
      `
    );
  }

  @test
  'Block params in HTML syntax - invalid mustaches in block params list'() {
    this.assert.throws(
      () => {
        preprocess('<x-bar as |{{foo}}|>foo</x-bar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError(
        'Invalid block parameters syntax: mustaches cannot be used inside block params'
      )`
        1 | <x-bar as |{{foo}}|>foo</x-bar>
          |        ----=======-
          |              \=== invalid mustache
      `
    );

    this.assert.throws(
      () => {
        preprocess('<x-bar as |foo{{bar}}|>foo</x-bar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError(
        'Invalid block parameters syntax: mustaches cannot be used inside block params'
      )`
        1 | <x-bar as |foo{{bar}}|>foo</x-bar>
          |        -------=======-
          |                 \=== invalid mustache
      `
    );

    this.assert.throws(
      () => {
        preprocess('<x-bar as |foo {{bar}}|>foo</x-bar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError(
        'Invalid block parameters syntax: mustaches cannot be used inside block params'
      )`
        1 | <x-bar as |foo {{bar}}|>foo</x-bar>
          |        --------=======-
          |                  \=== invalid mustache
      `
    );

    this.assert.throws(
      () => {
        preprocess('<x-bar as |foo| {{bar}}>foo</x-bar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError('Invalid block parameters syntax: modifiers cannot follow block params')`
        1 | <x-bar as |foo| {{bar}}>foo</x-bar>
          |                 =======
          |                    \=== invalid modifier
      `
    );
  }

  @test
  'Block params in HTML syntax - EOF in block params list'() {
    this.assert.throws(
      () => {
        preprocess('<x-bar as |', { meta: { moduleName: 'test-module' } });
      },
      syntaxErrorFor(
        'Invalid block parameters syntax: expecting the tag to be closed with ">" or "/>" after block params',
        'as |',
        'test-module',
        1,
        7
      )
    );

    this.assert.throws(
      () => {
        preprocess('<x-bar as |foo', { meta: { moduleName: 'test-module' } });
      },
      syntaxErrorFor(
        'Invalid block parameters syntax: expecting the tag to be closed with ">" or "/>" after block params',
        'as |foo',
        'test-module',
        1,
        7
      )
    );

    this.assert.throws(
      () => {
        preprocess('<x-bar as |foo|', { meta: { moduleName: 'test-module' } });
      },
      syntaxErrorFor(
        'Invalid block parameters syntax: expecting the tag to be closed with ">" or "/>" after block params',
        'as |foo|',
        'test-module',
        1,
        7
      )
    );
  }

  @test
  'Block params in HTML syntax - Throws an error on invalid block params syntax'() {
    this.assert.throws(
      () => {
        preprocess('<x-bar as |x y>{{x}},{{y}}</x-bar>', { meta: { moduleName: 'test-module' } });
      },
      syntaxErrorFor(
        'Invalid block parameters syntax: expecting "|" but the tag was closed prematurely',
        'as |x y>',
        'test-module',
        1,
        7
      )
    );

    this.assert.throws(
      () => {
        preprocess('<x-bar as |x| wat>{{x}},{{y}}</x-bar>', {
          meta: { moduleName: 'test-module' },
        });
      },
      syntaxErrorFor(
        'Invalid block parameters syntax: expecting the tag to be closed with ">" or "/>" after block params',
        'wat',
        'test-module',
        1,
        14
      )
    );

    this.assert.throws(
      () => {
        preprocess('<x-bar as |x| y|>{{x}},{{y}}</x-bar>', { meta: { moduleName: 'test-module' } });
      },
      syntaxErrorFor(
        'Invalid block parameters syntax: expecting the tag to be closed with ">" or "/>" after block params',
        'y|',
        'test-module',
        1,
        14
      )
    );
  }

  @test
  'Block params in HTML syntax - Throws an error on invalid identifiers for params'() {
    this.assert.throws(
      () => {
        preprocess('<x-bar as |x foo.bar|></x-bar>', { meta: { moduleName: 'test-module' } });
      },
      syntaxErrorFor(
        'Invalid block parameters syntax: invalid identifier name `foo.bar`',
        'foo.bar',
        'test-module',
        1,
        13
      )
    );

    this.assert.throws(
      () => {
        preprocess('<x-bar as |x "foo"|></x-bar>', { meta: { moduleName: 'test-module' } });
      },
      syntaxErrorFor(
        'Invalid block parameters syntax: invalid identifier name `"foo"`',
        '"foo"',
        'test-module',
        1,
        13
      )
    );

    this.assert.throws(
      () => {
        preprocess('<x-bar as |foo[bar]|></x-bar>', { meta: { moduleName: 'test-module' } });
      },
      syntaxErrorFor(
        'Invalid block parameters syntax: invalid identifier name `foo[bar]`',
        'foo[bar]',
        'test-module',
        1,
        11
      )
    );
  }

  @test
  'Block params in HTML syntax - Throws an error on missing `as`'() {
    this.assert.throws(
      () => {
        preprocess('<x-bar |x|></x-bar>', { meta: { moduleName: 'test-module' } });
      },
      syntaxErrorFor(
        'Invalid block parameters syntax: block parameters must be preceded by the `as` keyword',
        '|x|',
        'test-module',
        1,
        7
      )
    );

    this.assert.throws(
      () => {
        preprocess('<x-bar><:baz |x|></:baz></x-bar>', {
          meta: { moduleName: 'test-module' },
        });
      },
      syntaxErrorFor(
        'Invalid block parameters syntax: block parameters must be preceded by the `as` keyword',
        '|x|',
        'test-module',
        1,
        13
      )
    );
  }
}

jitSuite(SyntaxErrors);
