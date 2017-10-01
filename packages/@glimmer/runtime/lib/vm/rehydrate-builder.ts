import { NewElementBuilder, ElementBuilder, ElementOperations } from "./element-builder";

import { Environment } from '../environment';
import Bounds, { bounds, Cursor } from '../bounds';
import { Simple, Option, Opaque } from "@glimmer/interfaces";
import { DynamicContentWrapper } from './content/dynamic';
import { expect, Stack, assert } from "@glimmer/util";
import { SVG_NAMESPACE } from "@glimmer/runtime";

class DebugStack extends Stack<Option<Simple.Node>> {
  push(n: Option<Simple.Node>) {
    console.log('Pushing:', n);

    if (this['stack'].indexOf(n) > -1) {
      debugger;
    }
    // if (n && n.nodeValue && n.nodeValue.indexOf('block:6') > -1) {

    // }
    super.push(n);
  }

  pop() {
    let n = super.pop();
    console.log('Poping:', n);
    return n;
  }
}

export class RehydrateBuilder extends NewElementBuilder implements ElementBuilder {
  private unmatchedAttributes: Option<Simple.Attribute[]> = null;
  private blockDepth = 0;
  private candidateStack = new DebugStack();

  constructor(env: Environment, parentNode: Simple.Element, nextSibling: Option<Simple.Node>) {
    super(env, parentNode, nextSibling);
    if (nextSibling) throw new Error("Rehydration with nextSibling not supported");
    this.candidateStack.push(parentNode.firstChild);
  }

  get candidate(): Option<Simple.Node> {
    let candidate = this.candidateStack.pop();
    console.log(`candidate`, candidate);
    if (!candidate) return null;

    return candidate;

    if (isComment(candidate) && getCloseBlockDepth(candidate) === this.blockDepth) {
      return null;
    } else {
      return candidate;
    }
  }

  private clearMismatch(candidate: Simple.Node) {
    if (isComment(candidate)) {
      let depth = getOpenBlockDepth(candidate);

      if (depth !== null) {
        this.clearBlock(depth);
        return;
      }
    }

    let current: Option<Simple.Node> = candidate;
    let until = this.nextSibling;

    while (current && current !== until) {
      current = this.remove(current);
    }

    this.candidateStack.push(null);
  }

  protected clearBlock(depth: number) {
    let current: Option<Simple.Node> = this.candidateStack.pop();

    while (current && !(isComment(current) && getCloseBlockDepth(current) === depth)) {
      current = this.remove(current);
    }

    assert(current && isComment(current) && getCloseBlockDepth(current) === depth, 'An opening block should be paired with a closing block comment');

    this.candidateStack.push(this.remove(current!));
  }

  __openBlock(): void {
    let { candidate } = this;
    if (candidate) {
      if (isComment(candidate)) {
        let depth = getOpenBlockDepth(candidate);
        if (depth !== null) this.blockDepth = depth;
        this.candidateStack.push(this.remove(candidate));
        // if (nextCandidate && isComment(nextCandidate) && isCloseBlock(nextCandidate as Simple.Comment)) {
        //   // Block was opened on client that was closed on server
        //   this.clearBlock(this.blockDepth);
        //   return;
        // }

        return;
      } else {
        this.clearMismatch(candidate);
      }
    }
  }

  __closeBlock(): void {
    let candidate = this.candidateStack.pop();

    debugger;
    if (candidate) {
      if (isComment(candidate)) {
        let depth = getCloseBlockDepth(candidate);

        if (depth !== null) this.blockDepth = depth - 1;

        if (isOpenBlock(candidate)) {
          // Block was closed on client that was open on server
          this.candidateStack.push(candidate); // TODO
          this.clearBlock(this.blockDepth);
          return;
        }


        let nextCandidate = this.remove(candidate);


        this.candidateStack.push(nextCandidate);

        console.log(nextCandidate, this.candidateStack.current, nextCandidate === this.candidateStack.current)
        // if (nextCandidate === null && !isComment(nextCandidate)) {
        //   this.candidateStack.push(nextCandidate);
        //   return;
        // }

        // if (nextCandidate && nextCandidate !== this.candidateStack.current) {
        //   this.candidateStack.push(nextCandidate);
        //   return;
        // }


        return;
      } else {
        this.clearMismatch(candidate);
      }
    }
  }

  __appendNode(node: Simple.Node): Simple.Node {
    let { candidate } = this;

    // This code path is only used when inserting precisely one node. It needs more
    // comparison logic, but we can probably lean on the cases where this code path
    // is actually used.
    if (candidate) {
      return candidate;
    } else {
      return super.__appendNode(node);
    }
  }

  __appendHTML(html: string): Bounds {
    let candidateBounds = this.markerBounds();

    if (candidateBounds) {
      let first = candidateBounds.firstNode()!;
      let last = candidateBounds.lastNode()!;

      let newBounds = bounds(this.element, first.nextSibling!, last.previousSibling!);

      this.remove(first);
      this.remove(last);

      return newBounds;
    } else {
      return super.__appendHTML(html);
    }
  }

  protected remove(node: Simple.Node): Option<Simple.Node> {
    let element = expect(node.parentNode, `cannot remove a detached node`) as Simple.Element;
    let next = node.nextSibling;
    console.log('Removing', node);
    element.removeChild(node);
    return next;
  }

  private markerBounds(): Option<Bounds> {
    let _candidate = this.candidateStack.pop();

    if (_candidate && isMarker(_candidate)) {
      let first = _candidate;
      let last = expect(first.nextSibling, `BUG: serialization markers must be paired`);

      while (last && !isMarker(last)) {
        last = expect(last.nextSibling, `BUG: serialization markers must be paired`);
      }

      return bounds(this.element, first, last);
    } else {
      return null;
    }
  }

  __appendText(string: string): Simple.Text {
    let { candidate } = this;

    if (candidate) {
      if (isTextNode(candidate)) {
        candidate.nodeValue = string;
        this.candidateStack.push(candidate.nextSibling);
        return candidate;
      } else if (candidate && (isSeparator(candidate) || isEmpty(candidate))) {
        this.candidateStack.push(candidate.nextSibling);
        this.remove(candidate);
        return this.__appendText(string);
      } else if (isEmpty(candidate)) {
        let next = this.remove(candidate);
        this.candidateStack.push(next);
        let text = this.dom.createTextNode(string);
        this.dom.insertBefore(this.element, text, next);
        return text;
      } else {
        this.clearMismatch(candidate);
        return super.__appendText(string);
      }
    } else {
      return super.__appendText(string);
    }
  }

  __appendComment(string: string): Simple.Comment {
    let _candidate = this.candidateStack.pop();

    if (_candidate && isComment(_candidate)) {
      _candidate.nodeValue = string;
      this.candidateStack.push(_candidate.nextSibling);
      return _candidate;
    } else if (_candidate) {
      this.clearMismatch(_candidate);
    }

    return super.__appendComment(string);
  }

  __openElement(tag: string, _operations?: ElementOperations): Simple.Element {
    let _candidate = this.candidateStack.pop();
    if (_candidate && isElement(_candidate) && isSameNodeType(_candidate, tag)) {
      this.unmatchedAttributes = [].slice.call(_candidate.attributes);
      this.candidateStack.push(_candidate.nextSibling);
      return _candidate;
    } else if (_candidate) {

      if (isOpenBlock(_candidate)) {
        this.candidateStack.push(_candidate);
      }

      this.clearMismatch(_candidate);
    }

    return super.__openElement(tag);
  }

  __setAttribute(name: string, value: string, namespace: Option<string>): void {
    let unmatched = this.unmatchedAttributes;

    if (unmatched) {
      let attr = findByName(unmatched, name);
      if (attr) {
        attr.value = value;
        unmatched.splice(unmatched.indexOf(attr), 1);
        return;
      }
    }

    return super.__setAttribute(name, value, namespace);
  }

  __setProperty(name: string, value: string): void {
    let unmatched = this.unmatchedAttributes;

    if (unmatched) {
      let attr = findByName(unmatched, name);
      if (attr) {
        attr.value = value;
        unmatched.splice(unmatched.indexOf(attr), 1);
        return;
      }
    }

    return super.__setProperty(name, value);
  }

  __flushElement(parent: Simple.Element, constructing: Simple.Element): void {
    let { unmatchedAttributes: unmatched } = this;
    if (unmatched) {
      for (let i=0; i<unmatched.length; i++) {
        this.constructing!.removeAttribute(unmatched[i].name);
      }
      this.unmatchedAttributes = null;
    } else {
      super.__flushElement(parent, constructing);
    }
  }

  appendCautiousDynamicContent(value: Opaque): DynamicContentWrapper {
    let content = super.appendCautiousDynamicContent(value);
    content.update(this.env, value);
    return content;
  }

  willCloseElement() {
    let { candidate } = this;

    if (candidate) {
      if (!(isCloseBlock(candidate) || isOpenBlock(candidate))) {
        this.clearMismatch(candidate);
      } else {
        debugger;
      }
    }

    if (this.candidateStack.current !== this.element.nextSibling) {
      this.candidateStack.push(this.element.nextSibling);
    }

    super.willCloseElement();
  }

  getMarker(element: Simple.Element, guid: string): Simple.Node {
    let marker = element.firstChild;
    if (marker && marker['id'] === guid) {
      return marker;
    }

    throw new Error('Cannot find serialized cursor for `in-element`');
  }

  pushRemoteElement(element: Simple.Element, cursorId: string, _nextSibling: Option<Simple.Node> = null) {
    let marker = this.getMarker(element, cursorId);

    if (marker.parentNode === element) {
      let candidate = marker.nextSibling;
      this.remove(marker);
      this.candidateStack.push(candidate);
      this.candidateStack.push(this.candidate);
      super.pushRemoteElement(element, cursorId, _nextSibling);
    }
  }

  popRemoteElement() {
    super.popRemoteElement();
    this.candidateStack.pop();
    this.candidateStack.pop();
  }

  didAppendBounds(bounds: Bounds): Bounds {
    super.didAppendBounds(bounds);
    let last = bounds.lastNode();
    if (last && last.nextSibling !== this.candidateStack.current) {
      this.candidateStack.push(last.nextSibling);
    }
    return bounds;
  }

  didOpenElement(element: Simple.Element): Simple.Element {
    super.didOpenElement(element);
    this.candidateStack.push(element.firstChild);
    return element;
  }
}

function isTextNode(node: Simple.Node): node is Simple.Text {
  return node.nodeType === 3;
}

function isComment(node: Simple.Node): node is Simple.Comment {
  return node.nodeType === 8;
}

function getOpenBlockDepth(node: Simple.Comment): Option<number> {
  let boundsDepth = node.nodeValue!.match(/^%\+block:(\d+)%$/);

  if (boundsDepth && boundsDepth[1]) {
    return Number(boundsDepth[1] as string);
  } else {
    return null;
  }
}

function getCloseBlockDepth(node: Simple.Comment): Option<number> {
  let boundsDepth = node.nodeValue!.match(/^%\-block:(\d+)%$/);

  if (boundsDepth && boundsDepth[1]) {
    return Number(boundsDepth[1] as string);
  } else {
    return null;
  }
}
function isElement(node: Simple.Node): node is Simple.Element {
  return node.nodeType === 1;
}

function isOpenBlock(node: Simple.Node): boolean {
  return node.nodeType === 8 && node.nodeValue!.charAt(1) === '+';
}

function isCloseBlock(node: Simple.Node): boolean {
  return node.nodeType === 8 && node.nodeValue!.charAt(1) === '-';
}

function isSameNodeType(candidate: Simple.Element, tag: string) {
  if (candidate.namespaceURI === SVG_NAMESPACE) {
    return candidate.tagName === tag;
  }
  return candidate.tagName === tag.toUpperCase();
}

function isMarker(node: Simple.Node): boolean {
  return node.nodeType === 8 && node.nodeValue === '%glimmer%';
}

function isSeparator(node: Simple.Node): boolean {
  return node.nodeType === 8 && node.nodeValue === '%sep%';
}

function isEmpty(node: Simple.Node): boolean {
  return node.nodeType === 8 && node.nodeValue === '%empty%';
}

function findByName(array: Simple.Attribute[], name: string): Simple.Attribute | undefined {
  for (let i = 0; i < array.length; i++) {
    let attr = array[i];
    if (attr.name === name) return attr;
  }

  return undefined;
}

export function rehydrationBuilder(env: Environment, cursor: Cursor) {
  return RehydrateBuilder.forInitialRender(env, cursor);
}
