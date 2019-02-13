import { astEqual } from '../support';
import {
  preprocess as parse,
  traverse,
  builders as b,
  cannotRemoveNode,
  cannotReplaceNode,
  AST,
} from '@glimmer/syntax';

QUnit.module('[glimmer-syntax] Traversal - manipulating');

function isSimple(node: AST.MustacheStatement | AST.BlockStatement, name: string): boolean {
  return (
    node.call.type === 'PathExpression' &&
    node.call.head.type === 'LocalReference' &&
    node.call.head.name === name &&
    node.call.tail === null
  );
}

function path(node: AST.MustacheStatement | AST.BlockStatement): string {
  if (node.call.type === 'PathExpression' && node.call.head.type === 'LocalReference') {
    return node.call.head.name;
  } else {
    throw new Error(`Couldn't compute simple path for ${JSON.stringify(node)}`);
  }
}

(['enter', 'exit'] as Array<'enter' | 'exit'>).forEach(eventName => {
  QUnit.test(`[${eventName}] Replacing self in a key (returning null)`, assert => {
    let ast = parse(`<x y={{z}} />`);
    let el = ast.body[0] as AST.ElementNode;
    let attr = el.attributes[0];

    assert.throws(() => {
      traverse(ast, {
        MustacheStatement: {
          [eventName]: (node: AST.MustacheStatement) => {
            if (isSimple(node, 'z')) {
              return null;
            }
            return;
          },
        },
      });
    }, cannotRemoveNode(attr.value, attr, 'value'));
  });

  QUnit.test(`[${eventName}] Replacing self in a key (returning an empty array)`, assert => {
    let ast = parse(`<x y={{z}} />`);
    let el = ast.body[0] as AST.ElementNode;
    let attr = el.attributes[0];

    assert.throws(() => {
      traverse(ast, {
        MustacheStatement: {
          [eventName](node: AST.MustacheStatement) {
            if (isSimple(node, 'z')) {
              return [];
            }
            return;
          },
        },
      });
    }, cannotRemoveNode(attr.value, attr, 'value'));
  });

  QUnit.test(`[${eventName}] Replacing self in a key (returning a node)`, () => {
    let ast = parse(`<x y={{z}} />`);

    traverse(ast, {
      MustacheStatement: {
        [eventName](node: AST.MustacheStatement) {
          if (isSimple(node, 'z')) {
            return b.mustache('a');
          }
          return;
        },
      },
    });

    astEqual(ast, `<x y={{a}} />`);
  });

  QUnit.test(
    `[${eventName}] Replacing self in a key (returning an array with a single node)`,
    () => {
      let ast = parse(`<x y={{z}} />`);

      traverse(ast, {
        MustacheStatement: {
          [eventName](node: AST.MustacheStatement) {
            if (isSimple(node, 'z')) {
              return [b.mustache('a')];
            }
            return;
          },
        },
      });

      astEqual(ast, `<x y={{a}} />`);
    }
  );

  QUnit.test(
    `[${eventName}] Replacing self in a key (returning an array with multiple nodes)`,
    assert => {
      let ast = parse(`<x y={{z}} />`);
      let el = ast.body[0] as AST.ElementNode;
      let attr = el.attributes[0];

      assert.throws(() => {
        traverse(ast, {
          MustacheStatement: {
            [eventName](node: AST.MustacheStatement) {
              if (isSimple(node, 'z')) {
                return [b.mustache('a'), b.mustache('b'), b.mustache('c')];
              }
              return;
            },
          },
        });
      }, cannotReplaceNode(attr.value, attr, 'value'));
    }
  );

  QUnit.test(`[${eventName}] Replacing self in an array (returning null)`, () => {
    let ast = parse(`{{x}}{{y}}{{z}}`);

    traverse(ast, {
      MustacheStatement: {
        [eventName](node: AST.MustacheStatement) {
          if (isSimple(node, 'y')) {
            return null;
          }
          return;
        },
      },
    });

    astEqual(ast, `{{x}}{{z}}`);
  });

  QUnit.test(`[${eventName}] Replacing self in an array (returning an empty array)`, () => {
    let ast = parse(`{{x}}{{y}}{{z}}`);

    traverse(ast, {
      MustacheStatement: {
        [eventName](node: AST.MustacheStatement) {
          if (isSimple(node, 'y')) {
            return [];
          }
          return;
        },
      },
    });

    astEqual(ast, `{{x}}{{z}}`);
  });

  QUnit.test(`[${eventName}] Replacing self in an array (returning a node)`, () => {
    let ast = parse(`{{x}}{{y}}{{z}}`);

    traverse(ast, {
      MustacheStatement: {
        [eventName](node: AST.MustacheStatement) {
          if (isSimple(node, 'y')) {
            return b.mustache('a');
          }
          return;
        },
      },
    });

    astEqual(ast, `{{x}}{{a}}{{z}}`);
  });

  QUnit.test(
    `[${eventName}] Replacing self in an array (returning an array with a single node)`,
    () => {
      let ast = parse(`{{x}}{{y}}{{z}}`);

      traverse(ast, {
        MustacheStatement: {
          [eventName](node: AST.MustacheStatement) {
            if (isSimple(node, 'y')) {
              return [b.mustache('a')];
            }
            return;
          },
        },
      });

      astEqual(ast, `{{x}}{{a}}{{z}}`);
    }
  );

  QUnit.test(
    `[${eventName}] Replacing self in an array (returning an array with multiple nodes)`,
    () => {
      let ast = parse(`{{x}}{{y}}{{z}}`);

      traverse(ast, {
        MustacheStatement: {
          [eventName](node: AST.MustacheStatement) {
            if (isSimple(node, 'y')) {
              return [b.mustache('a'), b.mustache('b'), b.mustache('c')];
            }
            return;
          },
        },
      });

      astEqual(ast, `{{x}}{{a}}{{b}}{{c}}{{z}}`);
    }
  );
});

QUnit.module('[glimmer-syntax] Traversal - manipulating (edge cases)');

QUnit.test('Inside of a block', () => {
  let ast = parse(`{{y}}{{#w}}{{x}}{{y}}{{z}}{{/w}}`);

  traverse(ast, {
    MustacheStatement(node) {
      if (isSimple(node, 'y')) {
        return [b.mustache('a'), b.mustache('b'), b.mustache('c')];
      }
      return;
    },
  });

  astEqual(ast, `{{a}}{{b}}{{c}}{{#w}}{{x}}{{a}}{{b}}{{c}}{{z}}{{/w}}`);
});

QUnit.test('Should recurrsively walk the transformed node', () => {
  let ast = parse(`{{x}}{{y}}{{z}}`);

  traverse(ast, {
    MustacheStatement(node) {
      if (isSimple(node, 'x')) {
        return b.mustache('y');
      } else if (isSimple(node, 'y')) {
        return b.mustache('z');
      }
      return;
    },
  });

  astEqual(ast, `{{z}}{{z}}{{z}}`);
});

QUnit.test('Should recurrsively walk the keys in the transformed node', () => {
  let ast = parse(`{{#foo}}{{#bar}}{{baz}}{{/bar}}{{else}}{{#bar}}{{bat}}{{/bar}}{{/foo}}`);

  traverse(ast, {
    BlockStatement(node) {
      if (isSimple(node, 'y')) {
        return b.block(
          b.path('x-foo'),
          node.params,
          node.hash,
          node.program,
          node.inverse,
          node.loc
        );
      } else if (isSimple(node, 'bar')) {
        return b.block(
          b.path('x-bar'),
          node.params,
          node.hash,
          node.program,
          node.inverse,
          node.loc
        );
      }
      return;
    },

    MustacheStatement: function(node) {
      if (isSimple(node, 'baz')) {
        return b.mustache('x-baz');
      } else if (isSimple(node, 'bar')) {
        return b.mustache('x-bat');
      }
      return;
    },
  });

  astEqual(
    ast,
    `{{#x-foo}}{{#x-bar}}{{x-baz}}{{/x-bar}}{{else}}{{#x-bar}}{{x-bat}}{{/x-bar}}{{/x-foo}}`
  );
});

QUnit.test('Exit event is not triggered if the node is replaced during the enter event', assert => {
  let ast = parse(`{{x}}`);

  let entered: Array<string | number | boolean | null | undefined> = [];
  let exited: Array<string | number | boolean | null | undefined> = [];

  traverse(ast, {
    MustacheStatement: {
      enter(node) {
        entered.push(path(node));
        return b.mustache('y');
      },
      exit(node) {
        exited.push(path(node));
      },
    },
  });

  assert.deepEqual(entered, ['x', 'y']);
  assert.deepEqual(exited, ['y']);
});
