import {
  highlightError,
  jitSuite,
  preprocess,
  RenderTest,
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
  'Block params in element syntax - missing space between as and pipes still produces invalid block params in simple element error'() {
    this.assert.throws(
      () => {
        preprocess('<x-bar as|foo|>foo</x-bar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError(
        'Unexpected block params in <x-bar>: simple elements cannot have block params'
      )`
        1 | <x-bar as|foo|>foo</x-bar>
          |        =======
          |          \=== unexpected block params
      `
    );
  }

  @test
  'Block params in component syntax - requires a space between as and pipes'() {
    this.assert.throws(
      () => {
        preprocess('<XBar as|foo|>foo</XBar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError(
        'Invalid block parameters syntax: expecting at least one space character between "as" and "|"'
      )`
        1 | <XBar as|foo|>foo</XBar>
          |       -==----
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
        'Unexpected block params in <x-bar>: simple elements cannot have block params'
      )`
        1 | <x-bar as ||>foo</x-bar>
          |        =====
          |            \=== unexpected block params
      `
    );

    this.assert.throws(
      () => {
        preprocess('<x-bar as | |>foo</x-bar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError(
        'Unexpected block params in <x-bar>: simple elements cannot have block params'
      )`
        1 | <x-bar as | |>foo</x-bar>
          |        ======
          |             \=== unexpected block params
      `
    );

    this.assert.throws(
      () => {
        preprocess('<XBar as | |>foo</XBar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError(
        'Invalid block parameters syntax: empty block params, expecting at least one identifier'
      )`
        1 | <XBar as | |>foo</XBar>
          |       ---===
          |           \=== empty block params
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
        'Unexpected block params in <x-bar>: simple elements cannot have block params'
      )`
        1 | <x-bar as |{{foo}}|>foo</x-bar>
          |        ============
          |              \=== unexpected block params
      `
    );

    this.assert.throws(
      () => {
        preprocess('<XBar as |{{foo}}|>foo</XBar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError(
        'Invalid block parameters syntax: mustaches cannot be used inside block params'
      )`
        1 | <XBar as |{{foo}}|>foo</XBar>
          |       ----=======-
          |              \=== invalid mustache
      `
    );

    this.assert.throws(
      () => {
        preprocess('<x-bar as |foo{{bar}}|>foo</x-bar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError(
        'Unexpected block params in <x-bar>: simple elements cannot have block params'
      )`
        1 | <x-bar as |foo{{bar}}|>foo</x-bar>
          |        ===============
          |                 \=== unexpected block params
      `
    );

    this.assert.throws(
      () => {
        preprocess('<XBar as |foo{{bar}}|>foo</XBar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError(
        'Invalid block parameters syntax: mustaches cannot be used inside block params'
      )`
        1 | <XBar as |foo{{bar}}|>foo</XBar>
          |       -------=======-
          |                 \=== invalid mustache
      `
    );

    this.assert.throws(
      () => {
        preprocess('<x-bar as |foo {{bar}}|>foo</x-bar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError(
        'Unexpected block params in <x-bar>: simple elements cannot have block params'
      )`
        1 | <x-bar as |foo {{bar}}|>foo</x-bar>
          |        ================
          |                 \=== unexpected block params
      `
    );

    this.assert.throws(
      () => {
        preprocess('<XBar as |foo {{bar}}|>foo</XBar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError(
        'Invalid block parameters syntax: mustaches cannot be used inside block params'
      )`
        1 | <XBar as |foo {{bar}}|>foo</XBar>
          |       --------=======-
          |                  \=== invalid mustache
      `
    );

    this.assert.throws(
      () => {
        preprocess('<x-bar as |foo| {{bar}}>foo</x-bar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError('Invalid block parameters syntax: modifiers cannot follow block params')`
        1 | <x-bar as |foo| {{bar}}>foo</x-bar>
          |        ---------=======
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
      highlightError(
        'Invalid block parameters syntax: template ended before block params were closed'
      )`
        1 | <x-bar as |
          |        ---=
          |            \=== end of template
          |         \------ block params
      `
    );

    this.assert.throws(
      () => {
        preprocess('<x-bar as |foo', { meta: { moduleName: 'test-module' } });
      },
      highlightError(
        'Invalid block parameters syntax: template ended before block params were closed'
      )`
        1 | <x-bar as |foo
          |        ------=
          |            \=== end of template
          |         \------ block params
      `
    );

    this.assert.throws(
      () => {
        preprocess('<x-bar as |foo|', { meta: { moduleName: 'test-module' } });
      },
      highlightError('Template unexpectedly ended before tag was closed')`
        1 | <x-bar as |foo|
          |               =
          |            \=== end of template
      `
    );
  }

  @test
  'Block params in HTML syntax - Throws an error on invalid block params syntax'() {
    this.assert.throws(
      () => {
        preprocess('<XBar as |x y>{{x}},{{y}}</XBar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError(
        'Invalid block parameters syntax: expecting "|" but the tag was closed prematurely'
      )`
        1 | <XBar as |x y>{{x}},{{y}}</XBar>
          |       -------=
          |              \=== unexpected closing tag
          |            \------ block params
      `
    );

    this.assert.throws(
      () => {
        preprocess('<XBar as |x| wat>{{x}},{{y}}</XBar>', {
          meta: { moduleName: 'test-module' },
        });
      },
      highlightError('Invalid attribute after block params')`
        1 | <XBar as |x| wat>{{x}},{{y}}</XBar>
          |       -------===
          |               \=== invalid attribute
          |            \------ block params
      `
    );

    this.assert.throws(
      () => {
        preprocess('<XBar as |x| y|>{{x}},{{y}}</XBar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError('Invalid attribute after block params')`
        1 | <XBar as |x| y|>{{x}},{{y}}</XBar>
          |       -------==
          |              \=== invalid attribute
          |            \------ block params
      `
    );
  }

  @test
  'Block params in HTML syntax - Throws an error on invalid identifiers for params'() {
    this.assert.throws(
      () => {
        preprocess('<XBar as |x foo.bar|></XBar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError('Invalid block parameters syntax: invalid identifier name `foo.bar`')`
        1 | <XBar as |x foo.bar|></XBar>
          |       ------=======-
          |              \=== invalid identifier
          |            \------ block params
      `
    );

    this.assert.throws(
      () => {
        preprocess('<XBar as |x "foo"|></XBar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError('Invalid block parameters syntax: invalid identifier name `"foo"`')`
        1 | <XBar as |x "foo"|></XBar>
          |       ------=====-
          |              \=== invalid identifier
          |            \------ block params
      `
    );

    this.assert.throws(
      () => {
        preprocess('<XBar as |foo[bar]|></XBar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError('Invalid block parameters syntax: invalid identifier name `foo[bar]`')`
        1 | <XBar as |foo[bar]|></XBar>
          |       ----========-
          |              \=== invalid identifier
          |            \------ block params
      `
    );
  }

  @test
  'Block params in HTML syntax - Throws an error on missing `as`'() {
    this.assert.throws(
      () => {
        preprocess('<XBar |x|></XBar>', { meta: { moduleName: 'test-module' } });
      },
      highlightError(
        'Invalid block parameters syntax: block parameters must be preceded by the `as` keyword'
      )`
        1 | <XBar |x|></XBar>
          |       ===
          |         \=== missing \`as\`
      `
    );

    this.assert.throws(
      () => {
        preprocess('<XBar><:baz |x|></:baz></XBar>', {
          meta: { moduleName: 'test-module' },
        });
      },
      highlightError(
        'Invalid block parameters syntax: block parameters must be preceded by the `as` keyword'
      )`
        1 | <XBar><:baz |x|></:baz></XBar>
          |             ===
          |               \=== missing \`as\`
      `
    );
  }
}

jitSuite(SyntaxErrors);
