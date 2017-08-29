import {
  DOMTreeConstruction
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
  protected tree: DOMTreeConstruction;

  before() {
    this.document = new SimpleDOM.Document();
    this.parent = document.createElement('div');
    this.tree = new DOMTreeConstruction(document);
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

    this.shouldEqual(`<span class="chad"></span>`)
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

  protected append() {
    this.tree.appendTo(this.parent);
  }

  protected shouldEqual(expected: string) {
    this.append();
    let actual = toHTML(this.parent);
    QUnit.assert.equal(actual, expected);
  }

  protected shouldEqualNS(expected: string) {
    this.append();
    let actual = toHTMLNS(this.parent);
    QUnit.assert.equal(actual, expected);
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
