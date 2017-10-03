import { NewElementBuilder, ElementBuilder, ElementOperations } from "./element-builder";

import { Environment } from '../environment';
import Bounds, { bounds, Cursor } from '../bounds';
import { Simple, Option, Opaque } from "@glimmer/interfaces";
import { DynamicContentWrapper } from './content/dynamic';
import { expect, assert, Stack } from "@glimmer/util";
import { SVG_NAMESPACE } from '../dom/helper';

export class RehydrateBuilder extends NewElementBuilder implements ElementBuilder {
  private unmatchedAttributes: Option<Simple.Attribute[]> = null;
  private depth = 0;
  private blockDepth = 0;
  private openCandidates = new Stack<Simple.Node>();
  private candidate: Option<Simple.Node> = null;

  constructor(env: Environment, parentNode: Simple.Element, nextSibling: Option<Simple.Node>) {
    super(env, parentNode, nextSibling);
    if (nextSibling) throw new Error("Rehydration with nextSibling not supported");
    this.candidate = parentNode.firstChild;
    // todo assert we have +block:0
  }

  private clearMismatch(candidate: Simple.Node) {
    let current: Option<Simple.Node> = candidate;
    let openCandidate = this.openCandidates.current;
    if (openCandidate !== null) {
      if (isComment(openCandidate)) {
        let openDepth = getOpenBlockDepth(openCandidate);
        let i = 0;
        while (current && !(isComment(current) && getCloseBlockDepth(current) === openDepth)) {
          current = this.remove(current);
          i++;
        }

        if (i > 1) this.clearBlock(); // TODO FIX ME
      } else {
        // assert current.parentNode === lastMatched
        while (current !== null) {
          current = this.remove(current);
        }
      }
      // current cursor parentNode should be openCandidate if element
      // or openCandidate.parentNode if comment
      this.cursorStack.current!.nextSibling = current;
    } // else we should always have at least block 0 or we didn't SSR and not safe to clear
    this.candidate = null;
  }

  __openBlock(): void {
    let { candidate } = this;

    if (candidate) {
      if (isComment(candidate) && getOpenBlockDepth(candidate) === this.blockDepth) {
        this.openCandidates.push(candidate);
        this.candidate = this.remove(candidate);
      } else {
        this.candidate = null;
        this.clearMismatch(candidate);
      }
    }
    this.depth++;
    this.blockDepth++;
  }

  __closeBlock(): void {
    if (this.depth === this.openCandidates.size) {
      let { candidate } = this;
      if (candidate !== null) {
        this.clearMismatch(candidate);
      }
      this.openCandidates.pop();
      // assert close block for this depth
      this.candidate = this.remove(this.nextSibling!);
    } else  {
      // asert this.candidate ===nulll
    }

    this.depth--;
    this.blockDepth--;
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
    element.removeChild(node);
    return next;
  }

  private markerBounds(): Option<Bounds> {
    let _candidate = this.candidate;

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
        this.candidate = candidate.nextSibling;
        return candidate;
      } else if (candidate && (isSeparator(candidate) || isEmpty(candidate))) {
        this.candidate = candidate.nextSibling;
        this.remove(candidate);
        return this.__appendText(string);
      } else if (isEmpty(candidate)) {
        let next = this.remove(candidate);
        this.candidate = next;
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
    let _candidate = this.candidate;
    if (_candidate && isComment(_candidate)) {
      // TODO should not rehydrated a special comment
      _candidate.nodeValue = string;
      this.candidate =_candidate.nextSibling;
      return _candidate;
    } else if (_candidate) {
      this.clearMismatch(_candidate);
    }

    return super.__appendComment(string);
  }

  __openElement(tag: string, _operations?: ElementOperations): Simple.Element {
    let _candidate = this.candidate;

    this.depth++;

    if (_candidate && isElement(_candidate) && isSameNodeType(_candidate, tag)) {
      this.unmatchedAttributes = [].slice.call(_candidate.attributes);
      this.openCandidates.push(_candidate);
      this.candidate = _candidate.firstChild;
      return _candidate;
    } else if (_candidate) {
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
      this.clearMismatch(candidate);
    }

    if (this.depth === this.openCandidates.size) {
      this.openCandidates.pop();
    }

    this.depth--;

    this.candidate = this.element.nextSibling;
    super.willCloseElement();
  }

  getMarker(element: Simple.Element, guid: string): Simple.Node {
    let marker = element.firstChild;
    if (marker && marker['id'] === guid) {
      return marker;
    }

    throw new Error('Cannot find serialized cursor for `in-element`');
  }

  clearBlock() {}

  pushRemoteElement(element: Simple.Element, cursorId: string, _nextSibling: Option<Simple.Node> = null) {
    let marker = this.getMarker(element, cursorId);

    if (marker.parentNode === element) {
      let candidate = marker.nextSibling;
      this.remove(marker);
      // this.candidateStack.push(candidate);
      // this.candidateStack.push(this.candidate);
      super.pushRemoteElement(element, cursorId, _nextSibling);
    }
  }

  popRemoteElement() {
    super.popRemoteElement();
    // this.candidateStack.pop();
    // this.candidateStack.pop();
  }

  didAppendBounds(bounds: Bounds): Bounds {
    super.didAppendBounds(bounds);
    // let last = bounds.lastNode();
    //this.candidateStack.push(last && last.nextSibling);
    return bounds;
  }

  didOpenElement(element: Simple.Element): Simple.Element {
    super.didOpenElement(element);
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

function isMarker(node: Simple.Node): boolean {
  return node.nodeType === 8 && node.nodeValue === '%glimmer%';
}

function isSeparator(node: Simple.Node): boolean {
  return node.nodeType === 8 && node.nodeValue === '%sep%';
}

function isEmpty(node: Simple.Node): boolean {
  return node.nodeType === 8 && node.nodeValue === '%empty%';
}
function isSameNodeType(candidate: Simple.Element, tag: string) {
  if (candidate.namespaceURI === SVG_NAMESPACE) {
    return candidate.tagName === tag;
  }
  return candidate.tagName === tag.toUpperCase();
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
