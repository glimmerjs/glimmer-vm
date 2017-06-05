import Bounds from '../bounds';
import { Environment } from '../environment';
import { ElementStack, ElementOperations, Tracker, UpdatableTracker } from "./element-builder";
import { DOMChanges, DOMTreeConstruction } from '../dom/helper';
import * as Simple from '../dom/interfaces';
import { Option } from "@glimmer/interfaces";
import { LinkedList, LinkedListNode, Destroyable } from "@glimmer/util";
import { VersionedReference } from "@glimmer/reference";

export class RehydrateBuilder implements ElementStack {
  static forInitialRender(env: Environment, parentNode: Simple.Element, nextSibling: Option<Simple.Node>) {
    return new RehydrateBuilder(env, parentNode, nextSibling);
  }

  dom: DOMTreeConstruction;
  updateOperations: DOMChanges;
  constructing: Option<Simple.Element>;
  operations: Option<ElementOperations>;

  constructor(public env: Environment, public element: Simple.Element, public nextSibling: Option<Simple.Node> = null) {}

  expectConstructing(_method: string): Element {
    throw new Error('Method not implemented.');
  }

  expectOperations(_method: string): ElementOperations {
    throw new Error('Method not implemented.');
  }

  block(): Tracker {
    throw new Error('Method not implemented.');
  }

  pushSimpleBlock(): Tracker {
    throw new Error('Method not implemented.');
  }

  pushUpdatableBlock(): UpdatableTracker {
    throw new Error('Method not implemented.');
  }

  pushBlockList(_list: LinkedList<LinkedListNode & Bounds & Destroyable>): Tracker {
    throw new Error('Method not implemented.');
  }

  popBlock(): Tracker {
    throw new Error('Method not implemented.');
  }

  pushRemoteElement(_element: Element, _nextSibling: Node | null): void {
    throw new Error('Method not implemented.');
  }

  popRemoteElement(): void {
    throw new Error('Method not implemented.');
  }

  newDestroyable(_d: Destroyable): void {
    throw new Error('Method not implemented.');
  }

  newBounds(_bounds: Bounds): void {
    throw new Error('Method not implemented.');
  }

  popElement(): void {
    throw new Error('Method not implemented.');
  }

  openElement(_tag: string, _operations ?: ElementOperations | undefined): Element {
    throw new Error('Method not implemented.');
  }

  flushElement(): void {
    throw new Error('Method not implemented.');
  }

  appendText(_string: string): Text {
    throw new Error('Method not implemented.');
  }

  appendComment(_string: string): Comment {
    throw new Error('Method not implemented.');
  }

  setStaticAttribute(_name: string, _value: string): void {
    throw new Error('Method not implemented.');
  }

  setStaticAttributeNS(_namespace: string, _name: string, _value: string): void {
    throw new Error('Method not implemented.');
  }

  setDynamicAttribute(_name: string, _reference: VersionedReference<string>, _isTrusting: boolean): void {
    throw new Error('Method not implemented.');
  }

  setDynamicAttributeNS(_namespace: string, _name: string, _reference: VersionedReference<string>, _isTrusting: boolean): void {
    throw new Error('Method not implemented.');
  }

  closeElement(): void {
    throw new Error('Method not implemented.');
  }
}