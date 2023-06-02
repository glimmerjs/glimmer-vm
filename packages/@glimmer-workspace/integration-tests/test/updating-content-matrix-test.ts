/* eslint-disable unicorn/prefer-dom-node-append */
import type { SimpleElement, SimpleNode } from '@glimmer/interfaces';
import type { SafeString } from '@glimmer/runtime';
import { NS_SVG } from '@glimmer/util';

import {
  jitSuite,
  RenderTest,
  type RenderTestConstructor,
  type TestFunction,
} from '@glimmer-workspace/integration-tests';
import type RenderDelegate from '../lib/render-delegate';

function makeSafeString(value: string): SafeString {
  return new SafeStringImpl(value);
}

class SafeStringImpl implements SafeString {
  constructor(private string: string) {}
  toHTML() {
    return this.string;
  }
  toString() {
    return this.string;
  }
}

class ContentTest extends RenderTest {
  static suiteName = 'Updating - Content';

  makeElement(tag: string, content: string): Element {
    let element = document.createElement(tag);
    element.appendChild(document.createTextNode(content));
    return element;
  }

  makeSVGElement(tag: string, content: string): Element {
    let element = document.createElementNS(NS_SVG, tag);
    element.appendChild(document.createTextNode(content));
    return element;
  }

  makeFragment(nodes: ChildNode[]) {
    let frag = document.createDocumentFragment();
    for (let node of nodes) frag.appendChild(node);
    return frag;
  }
}

// Test cases to matrix:
// const helper returns const SafeString
// non-const
// safe string
// unsafe string
// swapping between safe and unsafe
// swapping between unsafe and safe

type ContentValue =
  | string
  | SafeString
  | null
  | undefined
  | number
  | boolean
  | Element
  | DocumentFragment;

interface ContentTestCase {
  name: string;
  template: string;
  values: Array<{
    input:
      | ContentValue
      | ((context: ContentTest, isHTML: boolean) => ContentValue)
      | { toString(): string };
    expected: string | ((context: ContentTest, isHTML: boolean) => string);
    description: string;
  }>;
}

function generateContentTestCase(
  suite: RenderTestConstructor<RenderDelegate, RenderTest>,
  tc: ContentTestCase
): void {
  for (let wrapper of [
    {
      name: 'HTML context, as the only child',
      isHTML: true,
      before: '<div>',
      after: '</div>',
    },
    {
      name: 'HTML context, as a sibling to adjecent text nodes',
      isHTML: true,
      before: '<div>before',
      after: 'after</div>',
    },
    {
      name: 'HTML context, as a sibling to adjecent elements',
      isHTML: true,
      before: '<div><b>before</b>',
      after: '<b>after</b></div>',
    },
    {
      name: 'SVG foreignObject context, as the only child',
      isHTML: true,
      before: '<svg><foreignObject>',
      after: '</foreignObject></svg>',
    },
    {
      name: 'SVG foreignObject context, as a sibling to adjecent text nodes',
      isHTML: true,
      before: '<svg><foreignObject>before',
      after: 'after</foreignObject></svg>',
    },
    {
      name: 'SVG foreignObject context, as a sibling to adjecent elements',
      isHTML: true,
      before: '<svg><foreignObject><b>before</b>',
      after: '<b>after</b></foreignObject></svg>',
    },
    {
      name: 'SVG context, as the only child',
      isHTML: false,
      before: '<svg><text>',
      after: '</text></svg>',
    },
    {
      name: 'SVG context, as a sibling to adjecent text nodes',
      isHTML: false,
      before: '<svg><text>before',
      after: 'after</text></svg>',
    },
    {
      name: 'SVG context, as a sibling to adjecent elements',
      isHTML: false,
      before: '<svg><text><text>before</text>',
      after: '<text>after</text></text></svg>',
    },
  ]) {
    let test = function (this: ContentTest) {
      let template = wrapper.before + tc.template + wrapper.after;
      for (let [
        index,
        { input: _input, expected: _expected, description },
      ] of tc.values.entries()) {
        let input: unknown;
        let expected: string;

        input = typeof _input === 'function' ? _input(this, wrapper.isHTML) : _input;

        expected = typeof _expected === 'function' ? _expected(this, wrapper.isHTML) : _expected;

        if (index === 0) {
          this.render(template, { value: input });
          this.assertHTML(
            wrapper.before + expected + wrapper.after,
            `expected initial render (${description})`
          );
        } else {
          this.rerender({ value: input });
          this.assertHTML(
            wrapper.before + expected + wrapper.after,
            `expected updated render (${description})`
          );
        }
      }
    };

    (test as Partial<TestFunction>).isTest = true;
    (test as Partial<TestFunction>).testModifier = 'test';
    (suite as any).prototype[`updating ${tc.name} produces expected result in ${wrapper.name}`] =
      test;
  }
}

generateContentTestCase(ContentTest, {
  name: 'double curlies',
  template: '{{this.value}}',
  values: [
    {
      input: 'hello',
      expected: 'hello',
      description: 'plain string',
    },
    {
      input: '<b>hello</b>',
      expected: '&lt;b&gt;hello&lt;/b&gt;',
      description: 'string containing HTML',
    },
    {
      input: null,
      expected: '',
      description: 'null literal',
    },
    {
      input: undefined,
      expected: '',
      description: 'undefined literal',
    },
    {
      input: '',
      expected: '',
      description: 'empty string',
    },
    {
      input: ' ',
      expected: ' ',
      description: 'blank string',
    },
    {
      input: (_test, isHTML) => makeSafeString(isHTML ? '<b>hello</b>' : '<text>hello</text>'),
      expected: (_test, isHTML) => (isHTML ? '<b>hello</b>' : '<text>hello</text>'),
      description: 'safe string containing HTML',
    },
    {
      input: makeSafeString(''),
      expected: '<!---->',
      description: 'empty safe string',
    },
    {
      input: makeSafeString(' '),
      expected: ' ',
      description: 'blank safe string',
    },
    {
      input: (test, isHTML) =>
        isHTML ? test.makeElement('p', 'hello') : test.makeSVGElement('text', 'hello'),
      expected: (_test, isHTML) => (isHTML ? '<p>hello</p>' : '<text>hello</text>'),
      description: 'DOM node containing an element with text',
    },
    {
      input: (test, isHTML) => {
        return isHTML
          ? test.makeFragment([test.makeElement('p', 'one'), test.makeElement('p', 'two')])
          : test.makeFragment([
              test.makeSVGElement('text', 'one'),
              test.makeSVGElement('text', 'two'),
            ]);
      },
      expected: (_test, isHTML) =>
        isHTML ? '<p>one</p><p>two</p>' : '<text>one</text><text>two</text>',
      description: 'DOM fragment containing multiple nodes',
    },
    {
      input: 'not modified',
      expected: 'not modified',
      description: 'plain string (not modified, first render)',
    },
    {
      input: 'not modified',
      expected: 'not modified',
      description: 'plain string (not modified, second render)',
    },
    {
      input: 0,
      expected: '0',
      description: 'number literal (0)',
    },
    {
      input: true,
      expected: 'true',
      description: 'boolean literal (true)',
    },
    {
      input: {
        toString() {
          return 'I am an Object';
        },
      },
      expected: 'I am an Object',
      description: 'object with a toString function',
    },
    {
      input: 'hello',
      expected: 'hello',
      description: 'reset',
    },
  ],
});

generateContentTestCase(ContentTest, {
  name: 'triple curlies',
  template: '{{{this.value}}}',
  values: [
    {
      input: 'hello',
      expected: 'hello',
      description: 'plain string',
    },
    {
      input: (_test, isHTML) => (isHTML ? '<b>hello</b>' : '<text>hello</text>'),
      expected: (_test, isHTML) => (isHTML ? '<b>hello</b>' : '<text>hello</text>'),
      description: 'string containing HTML',
    },
    {
      input: null,
      expected: '<!--->',
      description: 'null literal',
    },
    {
      input: undefined,
      expected: '<!--->',
      description: 'undefined literal',
    },
    {
      input: '',
      expected: '<!--->',
      description: 'empty string',
    },
    {
      input: ' ',
      expected: ' ',
      description: 'blank string',
    },
    {
      input: (_test, isHTML) => makeSafeString(isHTML ? '<b>hello</b>' : '<text>hello</text>'),
      expected: (_test, isHTML) => (isHTML ? '<b>hello</b>' : '<text>hello</text>'),
      description: 'safe string containing HTML',
    },
    {
      input: makeSafeString(''),
      expected: '<!---->',
      description: 'empty safe string',
    },
    {
      input: makeSafeString(' '),
      expected: ' ',
      description: 'blank safe string',
    },
    {
      input: (test, isHTML) =>
        isHTML ? test.makeElement('p', 'hello') : test.makeSVGElement('text', 'hello'),
      expected: (_test, isHTML) => (isHTML ? '<p>hello</p>' : '<text>hello</text>'),
      description: 'DOM node containing an element with text',
    },
    {
      input: (test, isHTML) => {
        return isHTML
          ? test.makeFragment([test.makeElement('p', 'one'), test.makeElement('p', 'two')])
          : test.makeFragment([
              test.makeSVGElement('text', 'one'),
              test.makeSVGElement('text', 'two'),
            ]);
      },
      expected: (_test, isHTML) =>
        isHTML ? '<p>one</p><p>two</p>' : '<text>one</text><text>two</text>',
      description: 'DOM fragment containing multiple nodes',
    },
    {
      input: 'not modified',
      expected: 'not modified',
      description: 'plain string (not modified, first render)',
    },
    {
      input: 'not modified',
      expected: 'not modified',
      description: 'plain string (not modified, second render)',
    },
    {
      input: 0,
      expected: '0',
      description: 'number literal (0)',
    },
    {
      input: true,
      expected: 'true',
      description: 'boolean literal (true)',
    },
    {
      input: {
        toString() {
          return 'I am an Object';
        },
      },
      expected: 'I am an Object',
      description: 'object with a toString function',
    },
    {
      input: 'hello',
      expected: 'hello',
      description: 'reset',
    },
  ],
});

jitSuite(ContentTest);
