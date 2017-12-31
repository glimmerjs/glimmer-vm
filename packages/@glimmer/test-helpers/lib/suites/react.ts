import { Simple } from '@glimmer/interfaces';
import { Opaque, Dict, Option } from "@glimmer/util";
import { RenderTest, test } from "../render-test";
import { strip, equalInnerHTML } from "../helpers";

declare namespace React {
  type Component = Element | string;

  interface Element {
    $$typeof: symbol;
  }

  interface Props extends Dict<Opaque> {
    children: Component[];
  }

  function createElement(tagName: string, props: Props): Element;
}

declare namespace ReactDOM {
  function render(element: React.Element, target: Simple.Element): void;
}

function toReact(element: Simple.Element): React.Element {
  return React.createElement(element.tagName.toLowerCase(), propsFor(element));
}
function propsFor(element: Simple.Element): React.Props {
  return { children: childrenFor(element) };
}

function childrenFor(element: Simple.Element): React.Component[] {
  let children: React.Component[] = [];
  let child: Option<Simple.Node> = element.firstChild;

  while (child) {
    if (isElement(child)) {
      children.push(toReact(child));
    } else if (isText(child)) {
      children.push(child.nodeValue!);
    } else {
      throw new Error(`Unsupported nodeType ${child.nodeType}`);
    }

    child = child.nextSibling;
  }

  return children;
}

function isElement(maybe: Simple.Node): maybe is Simple.Element {
  // FIXME: cycle here
  return maybe.nodeType === 1; // Simple.NodeType.Element;
}

function isText(maybe: Simple.Node): maybe is Simple.Text {
  // FIXME: cycle here
  return maybe.nodeType === 3; // Simple.NodeType.Text;
}

export class ReactTests extends RenderTest {
  render(template: string, context: Dict<Opaque> = {}): void {
    super.render(template, context);
    ReactDOM.render(toReact(this.element), this.fixture);
  }

  rerender(properties: Dict<Opaque> = {}) {
    super.rerender(properties);
    ReactDOM.render(toReact(this.element), this.fixture);
  }

  get fixture(): Element {
    return document.getElementById('qunit-fixture')!;
  }

  @test
  "hello world"() {
    this.render(strip`<div>Hello, {{name}}!</div>`, {
      name: 'Godfrey'
    });

    equalInnerHTML(this.fixture, '<div><div>Hello, Godfrey!</div></div>');

    this.rerender();

    equalInnerHTML(this.fixture, '<div><div>Hello, Godfrey!</div></div>');

    this.rerender({ name: 'Brent' });

    equalInnerHTML(this.fixture, '<div><div>Hello, Brent!</div></div>');

    this.rerender({ name: 'Godfrey' });

    equalInnerHTML(this.fixture, '<div><div>Hello, Godfrey!</div></div>');
  }
}
