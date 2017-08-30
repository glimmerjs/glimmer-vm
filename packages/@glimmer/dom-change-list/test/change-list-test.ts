import {
  DOMTreeConstruction, NodeTokens
} from '@glimmer/dom-change-list';

import * as SimpleDOM from "simple-dom";
import { Simple, Option } from "@glimmer/interfaces";

import { TestCase, module, test } from './test-case';

const SVG: Simple.Namespace = "http://www.w3.org/2000/svg";
const XLINK: Simple.Namespace = "http://www.w3.org/1999/xlink";

@module('[dom-change-list] DOMTreeConstruction')
export class ChangeListTest extends TestCase {
  protected document: Simple.Document;
  protected parent: Simple.Element | Simple.DocumentFragment;
  protected tree: Builder;
  protected construction: DOMTreeConstruction;

  before() {
    this.document = new SimpleDOM.Document();
    this.parent = document.createElement('div');
    this.construction = new DOMTreeConstruction(document);
    this.tree = new Builder(this.construction);
  }

  @test "appendText"() {
    this.tree.appendText('hello world');
    this.shouldEqual('hello world');
  }

  @test "appendComent"() {
    this.tree.appendComment('hello world');
    this.shouldEqual('<!--hello world-->');
  }

  @test "openElement and closeElement"() {
    let { tree } = this;

    tree.openElement('span');
    tree.appendText('hello world');
    tree.closeElement();
    tree.openElement('span');
    tree.appendComment('hello world');
    tree.closeElement();

    this.shouldEqual('<span>hello world</span><span><!--hello world--></span>');
  }

  @test "setAttribute"() {
    let { tree } = this;

    tree.openElement('span');
    tree.setAttribute('class', 'chad');
    tree.closeElement();

    this.shouldEqual(`<span class="chad"></span>`);
  }

  @test "nested elements"() {
    let { tree } = this;

    tree.openElement('p');
    tree.setAttribute('class', 'chad');
    tree.appendText('hi chad');
    tree.openElement('i');
    tree.appendText(' - ');
    tree.closeElement();
    tree.appendText('it works!');
    tree.closeElement();

    this.shouldEqual(`<p class="chad">hi chad<i> - </i>it works!</p>`);
  }

  @test "namespaced elements"() {
    let { tree } = this;

    tree.openElement('svg', SVG);
    tree.closeElement();

    this.shouldEqualNS('<svg:svg></svg:svg>');
  }

  @test "namespaced attributes"() {
    let { tree } = this;

    tree.openElement('svg', SVG);
    tree.openElement('a', SVG);
    tree.setAttribute('fill', 'red');
    tree.setAttribute('href', 'linky', XLINK);
    tree.closeElement();
    tree.closeElement();

    this.shouldEqualNS('<svg:svg><svg:a fill="red" xlink:href="linky"></svg:a></svg:svg>');
  }

  protected append(): NodeTokens {
    return this.construction.appendTo(this.parent);
  }

  protected shouldEqual(expectedHTML: string) {
    let tokens = this.append();
    let actualHTML = toHTML(this.parent);
    QUnit.assert.equal(actualHTML, expectedHTML);

    let { expected, actual } = this.tree.reify(tokens);

    QUnit.assert.deepEqual(actual, expected);
  }

  protected shouldEqualNS(expected: string) {
    this.append();
    let actual = toHTMLNS(this.parent);
    QUnit.assert.equal(actual, expected);
  }
}

export interface ExpectedToken {
  type: 'element' | 'text' | 'comment';
  value: string;
}

export class Builder {
  private expected: ExpectedToken[] = [];

  constructor(private tree: DOMTreeConstruction) {}

  openElement(tag: string, namespace?: Simple.Namespace) {
    let token = this.tree.openElement(tag, namespace);
    this.expected[token] = { type: 'element', value: tag.toUpperCase() };
  }

  closeElement() {
    this.tree.closeElement();
  }

  setAttribute(name: string, value: string, namespace?: Simple.Namespace) {
    this.tree.setAttribute(name, value, namespace);
  }

  appendText(text: string) {
    let token = this.tree.appendText(text);
    this.expected[token] = { type: 'text', value: text };
  }

  appendComment(text: string) {
    let token = this.tree.appendComment(text);
    this.expected[token] = { type: 'comment', value: text };
  }

  reify(tokens: NodeTokens): { actual: ExpectedToken[], expected: ExpectedToken[] } {
    let actual: ExpectedToken[] = [];
    let { expected } = this;

    for (let i=0; i<expected.length; i++) {
      let reified = tokens.reify(i);

      switch(reified.nodeType) {
        case 1:
          actual.push({ type: 'element', value: reified['tagName'] });
          break;
        case 3:
          actual.push({ type: 'text', value: reified.nodeValue! });
          break;
        case 8:
          actual.push({ type: 'comment', value: reified.nodeValue! });
          break;
      }
    }

    return { expected, actual };
  }
}

function toHTML(parent: Simple.Element | Simple.DocumentFragment) {
  let serializer = new SimpleDOM.HTMLSerializer(SimpleDOM.voidMap);

  return serializer.serializeChildren(parent);
}

function toHTMLNS(parent: Simple.Element | Simple.DocumentFragment) {
  let serializer = new NamespacedHTMLSerializer(SimpleDOM.voidMap);

  return serializer.serializeChildren(parent);
}

class NamespacedHTMLSerializer extends SimpleDOM.HTMLSerializer {
  openTag(element: Simple.Element): string {
    if (element.namespaceURI === SVG) {
      return '<svg:' + element.tagName.toLowerCase() + this.attributes(element.attributes) + '>';
    } else {
      return super.openTag(element);
    }
  }

  closeTag(element: Simple.Element): string {
    if (element.namespaceURI === SVG) {
      return '</svg:' + element.tagName.toLowerCase() + '>';
    } else {
      return super.closeTag(element);
    }
  }

  attr(original: Simple.Attribute): string {
    let attr: { name: string, value: Option<string>, specified: boolean };
    if (original.namespaceURI === XLINK) {
      attr = { name: `xlink:${original.name}`, value: original.value, specified: original.specified };
    } else {
      attr = original;
    }

    return super.attr(attr);
  }
}
