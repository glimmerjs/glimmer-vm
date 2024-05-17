import type {
  ASTPluginBuilder,
  Builders,
  NodeVisitor,
  PrecompileOptionsWithLexicalScope,
} from '@glimmer/syntax';
import { builders as b, normalize, src } from '@glimmer/syntax';

import { element } from './parser-node-test';
import { astEqual } from './support';

const { module, test, assert } = QUnit;

module('[glimmer-syntax] AST Builders', () => {
  test('element uses comments as loc when comments is not an array', () => {
    let actual = element('div', ['loc', b.loc(1, 1, 1, 1)]);
    let expected = element('div', ['loc', b.loc(1, 1, 1, 1)]);

    astEqual(actual, expected);
  });

  module(`synthetic locations`, () => {
    module(`for attributes`, () => {
      //   test(`don't emit warnings`, () => {
      //     let test = new TestOptions((b) => ({
      //       AttrNode: (node) => b.attr.name
      //     }));
      //     test.normalize(`<Component name="Godfrey" />`);
      //     test.expectLogs([]);
      //   });
      // });
      // test(`for tag names`, () => {
      //   let test = new TestOptions((b) => ({
      //     ElementNode: (node) => {
      //       node.loc = node.loc.replace('table');
      //     },
      //   }));
      //   test.normalize(`<table />`);
      //   test.expectLogs([]);
      // });
    });
  });
});

class TestOptions {
  #logs: string[] = [];
  #options: PrecompileOptionsWithLexicalScope;

  constructor(visitors: (builders: Builders) => NodeVisitor) {
    this.#logs = [];
    this.#options = {
      log: {
        warn: (message) => this.#logs.push(message),
      },
      lexicalScope: () => false,
      plugins: plugin(visitors),
    };
  }

  normalize(source: string) {
    normalize(new src.Source(source), this.#options);
  }

  get options() {
    return this.#options;
  }

  expectLogs(logs: string[]) {
    assert.deepEqual(this.#logs, logs);
    this.#logs = [];
  }
}

function plugin(visitors: (builders: Builders) => NodeVisitor): {
  ast: ASTPluginBuilder[];
} {
  return {
    ast: [
      (env) => {
        return {
          name: 'test-plugin',
          visitor: visitors(env.syntax.builders),
        };
      },
    ],
  };
}
