import { Simple } from '@glimmer/interfaces';
import { NodeToken, NodeTokens } from './node-tokens';
import { HTML, OperationsBuilder, run } from './dom-operations';

// https://github.com/whatwg/dom/issues/270

export class DOMTreeConstruction {
  private tokens = new NodeTokens();
  private ops: number[] = [];
  private builder: OperationsBuilder;

  constructor(private document: Simple.Document) {
    this.builder = new OperationsBuilder(this.ops);
  }

  openElement(name: string, ns: Simple.Namespace = HTML): NodeToken {
    this.builder.openElement(name, ns);
  }

  closeElement() {
    this.builder.closeElement();
  }

  appendText(text: string) {
    this.builder.appendText(text);
  }

  appendComment(text: string) {
    this.builder.appendComment(text);
  }

  setAttribute(name: string, value: string, namespace: Simple.Namespace = HTML) {
    this.builder.setAttribute(name, value, namespace);
  }

  appendTo(parent: Simple.Element | Simple.DocumentFragment): Iterable<void> {
    let { ops, constants } = this.builder.finish();

    run(ops, {
      document: this.document,
      parent,
      nextSibling: null,
      constants: constants
    });
  }
}