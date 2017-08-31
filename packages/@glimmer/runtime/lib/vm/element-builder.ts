import { TreeBuilder } from "@glimmer/dom-change-list";
import { Simple, NodeToken, Option, NodeTokens, Destroyable } from "@glimmer/interfaces";
import Environment from '../environment';
import { Cursor, Bounds } from '../bounds';

export interface ElementBuilder {
  constructing: Option<NodeToken>;
  parent: Option<NodeToken>;

  tree: TreeBuilder;

  openElement(tag: string): NodeToken;
  setAttribute(name: string, value: string, namespace?: Simple.Namespace): void;
  closeElement(): void;
  openBlock(): void;
  closeBlock(): Bounds & Destroyable;
  appendText(text: string): NodeToken;
  appendComment(text: string): NodeToken;
  appendTo(document: Simple.Document): NodeTokens;

  addDestructor(destructor: Destroyable): void;

  // convenience
  flushElement(): void;
}

export class NewElementBuilder implements ElementBuilder {
  static resume(_env: any, bounds: Bounds) {
    return new NewElementBuilder(_env, { element: bounds.parentElement(), nextSibling: bounds.firstNode() });
  }

  public tree = new TreeBuilder();
  public constructing: Option<NodeToken> = null;

  private parents: NodeToken[] = [];
  private blocks: DynamicBlock[] = [];

  constructor(_env: Environment, private cursor: Cursor) {}

  get parent(): NodeToken {
    return this.parents[this.parents.length - 1];
  }

  openElement(tag: string): NodeToken {
    return this.constructing = this.tree.openElement(tag);
  }

  setAttribute(name: string, value: string, namespace?: Simple.Namespace): void {
    this.tree.setAttribute(name, value, namespace);
  }

  flushElement() {
    this.parents.push(this.constructing!);
    this.constructing = null;
  }

  closeElement() {
    this.parents.pop();
    this.tree.closeElement();
  }

  openStaticBlock() {}
  closeStaticBlock() {}

  openDynamicBlock() {
    this.blocks.push(new DynamicBlock());
  }

  closeDynamicBlock() {
    this.blocks.pop();
  }

  appendText(text: string): NodeToken {
    return this.tree.appendText(text);
  }

  appendComment(text: string): NodeToken {
    return this.tree.appendComment(text);
  }

  addDestructor() {

  }

  appendTo(document: Simple.Document): NodeTokens {
    return this.tree.appendTo(this.cursor.element, document);
  }
}

interface Block {}

class DynamicBlock {
  private destructors: Destroyable[] = [];

  addDestructor(destructor: Destroyable) {
    this.destructors.push(destructor);
  }
}
