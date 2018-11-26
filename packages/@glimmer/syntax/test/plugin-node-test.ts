import {
  preprocess,
  Syntax,
  Walker,
  AST,
  ASTPluginEnvironment,
  ASTPluginBuilder,
} from '@glimmer/syntax';

const { test } = QUnit;

QUnit.module('[glimmer-syntax] Plugins - AST Transforms');

test('function based AST plugins can be provided to the compiler', assert => {
  assert.expect(1);

  preprocess('<div></div>', {
    plugins: {
      ast: [
        () => ({
          name: 'plugin-a',
          visitor: {
            Program() {
              assert.ok(true, 'transform was called!');
            },
          },
        }),
      ],
    },
  });
});

test('plugins are provided the syntax package', assert => {
  assert.expect(1);

  preprocess('<div></div>', {
    plugins: {
      ast: [
        ({ syntax }) => {
          assert.equal(syntax.Walker, Walker);

          return { name: 'plugin-a', visitor: {} };
        },
      ],
    },
  });
});

test('can support the legacy AST transform API via ASTPlugin', assert => {
  function ensurePlugin(FunctionOrPlugin: any): ASTPluginBuilder {
    if (FunctionOrPlugin.prototype && FunctionOrPlugin.prototype.transform) {
      return (env: ASTPluginEnvironment) => {
        return {
          name: 'plugin-a',

          visitor: {
            Program(node: AST.Program) {
              let plugin = new FunctionOrPlugin(env);

              plugin.syntax = env.syntax;

              return plugin.transform(node);
            },
          },
        };
      };
    } else {
      return FunctionOrPlugin;
    }
  }

  class Plugin {
    syntax!: Syntax;

    transform(program: AST.Program): AST.Program {
      assert.ok(true, 'transform was called!');
      return program;
    }
  }

  preprocess('<div></div>', {
    plugins: {
      ast: [ensurePlugin(Plugin)],
    },
  });
});

test('AST plugins can be chained', assert => {
  assert.expect(3);

  let firstPlugin = new WeakSet();
  let secondPlugin = new WeakSet();
  let thirdPlugin = new WeakSet();

  let first = () => {
    return {
      name: 'first',
      visitor: {
        Program(program: AST.Program) {
          firstPlugin.add(program);
        },
      },
    };
  };

  let second = () => {
    return {
      name: 'second',
      visitor: {
        Program(node: AST.Program) {
          assert.equal(firstPlugin.has(node), 'AST from first plugin is passed to second');

          secondPlugin.add(node);
        },
      },
    };
  };

  let third = () => {
    return {
      name: 'third',
      visitor: {
        Program(node: AST.Program) {
          assert.equal(secondPlugin.has(node), true, 'AST from second plugin is passed to third');

          thirdPlugin.add(node);
        },
      },
    };
  };

  let ast = preprocess('<div></div>', {
    plugins: {
      ast: [first, second, third],
    },
  });

  assert.equal(thirdPlugin.has(ast), 'return value from last AST transform is used');
});
