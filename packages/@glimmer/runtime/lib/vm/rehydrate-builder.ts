import { NewElementBuilder, ElementStack, ElementOperations } from "./element-builder";

// import Bounds from '../bounds';
import { Environment } from '../environment';
// import { NewElementBuilder, ElementStack, ElementOperations, Tracker, UpdatableTracker } from "./element-builder";
// import { DOMChanges, DOMTreeConstruction } from '../dom/helper';
import * as Simple from '../dom/interfaces';
import { Option } from "@glimmer/interfaces";
import { VersionedReference } from "@glimmer/reference";
// import { LinkedList, LinkedListNode, Destroyable } from "@glimmer/util";
// import { VersionedReference } from "@glimmer/reference";

export class RehydrateBuilder extends NewElementBuilder implements ElementStack {
  private candidate: Option<Simple.Node>;

  constructor(env: Environment, parentNode: Simple.Element, nextSibling: Option<Simple.Node>) {
    super(env, parentNode, nextSibling);
    if (nextSibling) throw new Error("Rehydration with nextSibling not supported");
    this.candidate = parentNode.firstChild;
  }

  appendText(string: string): Simple.Text {
    let { candidate } = this;

    if (candidate && isTextNode(candidate)) {
      candidate.nodeValue = string;
      this.newNode(candidate);
      return candidate;
    } else {
      return super.appendText(string);
    }
  }

  appendComment(string: string): Simple.Comment {
    throw unimplemented();
  }

  openElement(tag: string, _operations?: ElementOperations): Simple.Element {
    let { candidate } = this;

    if (candidate && isElement(candidate) && candidate.tagName === tag.toUpperCase()) {
      // workaround argument.length transpile of arg initializer
      let operations = _operations === undefined ? this.defaultOperations : _operations;

      this.constructing = candidate;
      this.operations = operations;
      return candidate;
    } else {
      return super.openElement(tag, _operations);
    }
  }

  flushElement() {
    throw unimplemented();
  }

  pushRemoteElement(element: Simple.Element, nextSibling: Option<Simple.Node> = null) {
    throw unimplemented();
  }

  popRemoteElement() {
    throw unimplemented();
  }

  setStaticAttribute(name: string, value: string) {
    throw unimplemented();
  }

  setStaticAttributeNS(namespace: string, name: string, value: string) {
    throw unimplemented();
  }

  setDynamicAttribute(name: string, reference: VersionedReference<string>, isTrusting: boolean) {
    throw unimplemented();
  }

  setDynamicAttributeNS(namespace: string, name: string, reference: VersionedReference<string>, isTrusting: boolean) {
    throw unimplemented();
  }

  closeElement() {
    throw unimplemented();
  }

  newNode<T extends Simple.Node>(node: T): T {
    super.newNode(node);
    this.candidate = node.nextSibling;
    return node;
  }
}

function isTextNode(node: Simple.Node): node is Simple.Text {
  return node.nodeType === 3;
}

function isElement(node: Simple.Node): node is Simple.Element {
  return node.nodeType === 1;
}

function unimplemented() {
  return new Error('Not implemented');
}
