import { NewElementBuilder, ElementStack, ElementOperations } from "./element-builder";

// import Bounds from '../bounds';
import { Environment } from '../environment';
// import { NewElementBuilder, ElementStack, ElementOperations, Tracker, UpdatableTracker } from "./element-builder";
// import { DOMChanges, DOMTreeConstruction } from '../dom/helper';
import * as Simple from '../dom/interfaces';
import { Option } from "@glimmer/interfaces";
// import { VersionedReference } from "@glimmer/reference";
import { expect } from "@glimmer/util";
// import { LinkedList, LinkedListNode, Destroyable } from "@glimmer/util";
// import { VersionedReference } from "@glimmer/reference";

export class RehydrateBuilder extends NewElementBuilder implements ElementStack {
  private candidate: Option<Simple.Node>;

  constructor(env: Environment, parentNode: Simple.Element, nextSibling: Option<Simple.Node>) {
    super(env, parentNode, nextSibling);
    if (nextSibling) throw new Error("Rehydration with nextSibling not supported");
    this.candidate = parentNode.firstChild;
  }

  __appendText(string: string): Simple.Text {
    let { candidate } = this;

    if (candidate && isTextNode(candidate)) {
      candidate.nodeValue = string;
      return candidate;
    } else {
      return super.__appendText(string);
    }
  }

  __appendComment(string: string): Simple.Text {
    let { candidate } = this;

    if (candidate && isComment(candidate)) {
      candidate.nodeValue = string;
      return candidate;
    } else {
      this.candidate = null;
      return super.__appendComment(string);
    }
  }

  __openElement(tag: string, _operations?: ElementOperations): Simple.Element {
    let { candidate } = this;

    if (candidate && isElement(candidate) && candidate.tagName === tag.toUpperCase()) {
      return candidate;
    } else {
      this.candidate = null;
      return super.__openElement(tag);
    }
  }

  __flushElement(parent: Simple.Element, constructing: Simple.Element) {
    if (!this.candidate) {
      super.flushElement();
    }
  }

  willCloseElement() {
    this.candidate = this.element.nextSibling;
    super.willCloseElement();
  }

  pushRemoteElement(element: Simple.Element, nextSibling: Option<Simple.Node> = null) {
    throw unimplemented();
  }

  popRemoteElement() {
    throw unimplemented();
  }

  // TODO: Remove unseen attributes
  // setStaticAttribute(name: string, value: string) {
  //   throw unimplemented();
  // }

  // setStaticAttributeNS(namespace: string, name: string, value: string) {
  //   throw unimplemented();
  // }

  // setDynamicAttribute(name: string, reference: VersionedReference<string>, isTrusting: boolean) {
  //   throw unimplemented();
  // }

  // setDynamicAttributeNS(namespace: string, name: string, reference: VersionedReference<string>, isTrusting: boolean) {
  //   throw unimplemented();
  // }

  didAppendNode<T extends Simple.Node>(node: T): T {
    super.didAppendNode(node);
    this.candidate = node.nextSibling;
    return node;
  }

  didOpenElement(element: Simple.Element): Simple.Element {
    super.didOpenElement(element);
    this.candidate = element.firstChild;
    return element;
  }
}

function isTextNode(node: Simple.Node): node is Simple.Text {
  return node.nodeType === 3;
}

function isComment(node: Simple.Node): node is Simple.Comment {
  return node.nodeType === 8;
}

function isElement(node: Simple.Node): node is Simple.Element {
  return node.nodeType === 1;
}

function unimplemented() {
  return new Error('Not implemented');
}
