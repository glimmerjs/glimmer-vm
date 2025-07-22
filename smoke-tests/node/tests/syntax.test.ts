import { preprocess } from '@glimmer/syntax';
import { describe, it, expect } from 'vitest';

describe('@glimmer/syntax', () => {
  it('process()', () => {
    // Note: The AST now includes a `paramsNode` field on ElementNode and Block nodes
    // to provide better location information for block parameters. This change was
    // introduced to support better error messages and TypeScript tooling.
    // The `paramsNode` is a BlockParams AST node that contains the parameter names
    // with their source locations, complementing the existing `params` array.
    //
    // This is NOT a breaking change for consumers using the visitor pattern because:
    // - The visitor only traverses fields listed in visitorKeys, which doesn't include paramsNode
    // - Existing code accessing node.params continues to work unchanged
    // - Only code that directly inspects the full AST (like this snapshot test) sees the new field
    // - Consumers can opt-in to using paramsNode for better location info when needed
    expect(preprocess('<h1></h1>')).toMatchInlineSnapshot(`
      {
        "blockParams": [],
        "body": [
          {
            "attributes": [],
            "blockParams": [],
            "children": [],
            "closeTag": {
              "end": {
                "column": 9,
                "line": 1,
              },
              "start": {
                "column": 4,
                "line": 1,
              },
            },
            "comments": [],
            "loc": {
              "end": {
                "column": 9,
                "line": 1,
              },
              "start": {
                "column": 0,
                "line": 1,
              },
            },
            "modifiers": [],
            "openTag": {
              "end": {
                "column": 4,
                "line": 1,
              },
              "start": {
                "column": 0,
                "line": 1,
              },
            },
            "params": [],
            "paramsNode": {
              "loc": {
                "end": {
                  "column": 3,
                  "line": 1,
                },
                "start": {
                  "column": 3,
                  "line": 1,
                },
              },
              "names": [],
              "type": "BlockParams",
            },
            "path": {
              "head": {
                "loc": {
                  "end": {
                    "column": 3,
                    "line": 1,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                  },
                },
                "name": "h1",
                "original": "h1",
                "type": "VarHead",
              },
              "loc": {
                "end": {
                  "column": 3,
                  "line": 1,
                },
                "start": {
                  "column": 1,
                  "line": 1,
                },
              },
              "original": "h1",
              "tail": [],
              "type": "PathExpression",
            },
            "selfClosing": false,
            "tag": "h1",
            "type": "ElementNode",
          },
        ],
        "loc": {
          "end": {
            "column": 9,
            "line": 1,
          },
          "start": {
            "column": 0,
            "line": 1,
          },
        },
        "type": "Template",
      }
    `);
  });
});
