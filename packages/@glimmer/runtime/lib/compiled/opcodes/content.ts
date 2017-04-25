import {
  Insertion,
  CautiousInsertion,
  TrustingInsertion,

  isSafeString,
  isNode,
  isString,
} from '../../upsert';
import { isComponentDefinition } from '../../component/interfaces';
import { DOMTreeConstruction, DOMChanges } from '../../dom/helper';
import { OpcodeJSON, UpdatingOpcode } from '../../opcodes';
import { VM, UpdatingVM } from '../../vm';
import { Reference, VersionedPathReference, ReferenceCache, isModified, isConst, map } from '@glimmer/reference';
import { Opaque } from '@glimmer/util';
import { Cursor, clear, Bounds, single, SingleNodeBounds } from '../../bounds';
import { Fragment } from '../../builder';
import { ConditionalReference } from '../../references';
import { APPEND_OPCODES, Op } from '../../opcodes';
import { FIX_REIFICATION } from '../../dom/interfaces';
import { unreachable } from '@glimmer/util';

export interface SafeString {
  toHTML(): string;
}

APPEND_OPCODES.add(Op.DynamicContent, (vm, { op1: trusting }) => {
  let reference = vm.stack.pop<VersionedPathReference<Opaque>>();
  let value = reference.value();
  let maybeTrusting = vm.constants.getOther(trusting) as boolean;
  let contentManager = vm.contentManager(maybeTrusting);

  if (isSafeString(value) || (!maybeTrusting && isNode(value))) {
    contentManager = vm.contentManager(true);
  }

  let normalized = contentManager.normalize(reference);
  let cache: ReferenceCache<Opaque>;

  if (isConst(reference)) {
    value = normalized.value();
  } else {
    cache = new ReferenceCache(normalized);
    value = cache.peek();
  }

  let stack = vm.elements();
  let newBounds = contentManager.insert(vm.env.getAppendOperations(), stack, value);
  let bounds = new Fragment(newBounds);

  stack.newBounds(bounds);

  if (cache /* i.e. !isConst(reference) */) {
    vm.updateWith(contentManager.updateWith(vm, reference, cache, bounds));
  }
});

export abstract class ContentManager<T> {
  abstract normalize(reference: Reference<Opaque>): Reference<T>;
  abstract insert(dom: DOMTreeConstruction, cursor: Cursor, value: T): Bounds;
  abstract updateWith(_vm: VM, _reference: Reference<Opaque>, cache: ReferenceCache<T>, bounds: Fragment): UpdatingOpcode
  abstract update(dom: DOMChanges, newValue: Opaque, oldValue: Opaque, bounds: Bounds): Bounds;
}

export class TrustingContentManager implements ContentManager<TrustingInsertion> {
  normalize(reference: Reference<Opaque>) {
    return map(reference, normalizeTrustedValue);
  }

  insertHTML(dom: DOMTreeConstruction, cursor: Cursor, value: string) {
    return dom.insertHTMLBefore(cursor.element, value, cursor.nextSibling);
  }

  insert(dom: DOMTreeConstruction, cursor: Cursor, value: TrustingInsertion) {
    if (isString(value)) {
      return this.insertHTML(dom, cursor, value);
    } else if (isNode(value)) {
      return CAUTIOUS_CONTENT_MANAGER.insertNode(dom, cursor, value);
    }

    throw unreachable();
  }

  updateHTML(dom: DOMChanges, value: string, bounds: Bounds) {
    let parentElement = bounds.parentElement();
    let nextSibling = clear(bounds);

    return dom.insertHTMLBefore(parentElement as FIX_REIFICATION<Element>, nextSibling as FIX_REIFICATION<Node>, value);
  }

  update(dom: DOMChanges, newValue: Opaque, _oldValue: Opaque, bounds: Bounds) {
    if (isString(newValue)) {
      return this.updateHTML(dom, newValue, bounds);
    } else if (isNode(newValue)) {
      return CAUTIOUS_CONTENT_MANAGER.updateNode(dom, newValue, bounds);
    }

    let cursor = new Cursor(bounds.parentElement(), clear(bounds));

    return this.insert(dom, cursor, newValue);
  }

  updateWith(_vm: VM, _reference: Reference<Opaque>, cache: ReferenceCache<TrustingInsertion>, bounds: Fragment) {
    return new OptimizedTrustingUpdateOpcode(cache, bounds);
  }
}

export class CautiousContentManager implements ContentManager<CautiousInsertion> {
  normalize(reference: Reference<Opaque>) {
    return map(reference, normalizeValue);
  }

  insertText(dom: DOMTreeConstruction, cursor: Cursor, value: string) {
    let textNode = dom.createTextNode(value);
    dom.insertBefore(cursor.element, textNode, cursor.nextSibling);
    return new SingleNodeBounds(cursor.element, textNode);
  }

  insertSafeString(dom: DOMTreeConstruction, cursor: Cursor, value: SafeString) {
    let stringValue = value.toHTML();
    return dom.insertHTMLBefore(cursor.element, stringValue, cursor.nextSibling);
  }

  insertNode(dom: DOMTreeConstruction, cursor: Cursor, node: Node) {
    dom.insertBefore(cursor.element, node, cursor.nextSibling);
    return single(cursor.element, node);
  }

  updateText(value: string, bounds: Bounds) {
    if (isString(value)) {
      let textNode = bounds.firstNode();
      textNode!.nodeValue = value;
    }

    return bounds;
  }

  updateSafeString(dom: DOMChanges, newValue: SafeString, oldValue: SafeString, bounds: Bounds) {
    let stringValue = newValue.toHTML();
    let oldStringValue = oldValue.toHTML();

    if (stringValue !== oldStringValue) {
      let parentElement = bounds.parentElement();
      let nextSibling = clear(bounds);

      let newBounds = dom.insertHTMLBefore(parentElement as FIX_REIFICATION<Element>, nextSibling as FIX_REIFICATION<Node>, stringValue);

      return newBounds;
    }

    return bounds;
  }

  updateNode(dom: DOMChanges, value: Node, bounds: Bounds) {
    let parentElement = bounds.parentElement();
    let nextSibling = clear(bounds);
    return dom.insertNodeBefore(parentElement as FIX_REIFICATION<Element>, value, nextSibling as FIX_REIFICATION<Node>);
  }

  update(dom: DOMChanges, newValue: Opaque, oldValue: Opaque, bounds: Bounds): Bounds {
    if (isString(newValue)) {
      return this.updateText(newValue, bounds);
    } else if (isSafeString(newValue)) {
      return this.updateSafeString(dom, newValue, oldValue as SafeString, bounds);
    } else if (isNode(newValue)) {
      return this.updateNode(dom, newValue, bounds);
    }

    let cursor = new Cursor(bounds.parentElement(), clear(bounds));

    return this.insert(dom, cursor, newValue);
  }

  insert(dom: DOMTreeConstruction, cursor: Cursor, value: Opaque) {
    if (isString(value)) {
      return this.insertText(dom, cursor, value);
    } else if (isSafeString(value)) {
      return this.insertSafeString(dom, cursor, value);
    } else if (isNode(value)) {
      return this.insertNode(dom, cursor, value);
    }

    throw unreachable();
  }

  updateWith(_vm: VM, _reference: Reference<Opaque>, cache: ReferenceCache<CautiousInsertion>, bounds: Fragment) {
    return new OptimizedCautiousUpdateOpcode(cache, bounds);
  }
}

export const CAUTIOUS_CONTENT_MANAGER = new CautiousContentManager();
export const TRUSTING_CONTENT_MANAGER = new TrustingContentManager();

function isEmpty(value: Opaque): boolean {
  return value === null || value === undefined || typeof value['toString'] !== 'function';
}

export function normalizeTextValue(value: Opaque): string {
  if (isEmpty(value)) {
    return '';
  }
  return String(value);
}

function normalizeTrustedValue(value: Opaque): TrustingInsertion {
  if (isEmpty(value)) {
    return '';
  }
  if (isString(value)) {
    return value;
  }
  if (isSafeString(value)) {
    return value.toHTML();
  }
  if (isNode(value)) {
    return value;
  }
  return String(value);
}

function normalizeValue(value: Opaque): CautiousInsertion {
  if (isEmpty(value)) {
    return '';
  }
  if (isString(value)) {
    return value;
  }
  if (isSafeString(value) || isNode(value)) {
    return value;
  }
  return String(value);
}

class IsComponentDefinitionReference extends ConditionalReference {
  static create(inner: Reference<Opaque>): IsComponentDefinitionReference {
    return new IsComponentDefinitionReference(inner);
  }

  toBool(value: Opaque): boolean {
    return isComponentDefinition(value);
  }
}

export abstract class UpdateOpcode<T extends Insertion> extends UpdatingOpcode {
  constructor(
    protected cache: ReferenceCache<T>,
    protected bounds: Fragment,
    // protected upsert: Upsert
  ) {
    super();
    this.tag = cache.tag;
  }

  evaluate(vm: UpdatingVM) {
    let manager = this.manager(vm);
    let oldValue = this.cache.peek();
    let newValue = this.cache.revalidate();
    if (isModified(newValue)) {
      let { bounds } = this;
      let { dom } = vm;
      let newBounds = manager.update(dom, newValue, oldValue, bounds.bounds);
      bounds.update(newBounds);
    }
  }

  abstract manager(vm: UpdatingVM): ContentManager<T>;

  toJSON(): OpcodeJSON {
    let { _guid: guid, type, cache } = this;

    return {
      guid,
      type,
      details: { lastValue: JSON.stringify(cache.peek()) }
    };
  }
}

export class OptimizedCautiousUpdateOpcode extends UpdateOpcode<CautiousInsertion> {
  type = 'optimized-cautious-update';

  manager(vm: UpdatingVM) {
    return vm.contentManager(false);
  }
}

export class OptimizedTrustingUpdateOpcode extends UpdateOpcode<TrustingInsertion> {
  type = 'optimized-trusting-update';
  manager(vm: UpdatingVM) {
    return vm.contentManager(true);
  }
}

