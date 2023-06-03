import { warnIfStyleNotTrusted } from '@glimmer/global-context';
import type {
  AttributeCursor,
  AttributeOperation,
  AttributeRef,
  BrowserTreeBuilderInterface,
  Dict,
  Nullable,
  PropRef,
  ServerTreeBuilderInterface,
  TreeBuilder,
} from '@glimmer/interfaces';
import { castToBrowser } from '@glimmer/util';

import { normalizeStringValue } from '../../dom/normalize';
import { ATTR, normalizeProperty } from '../../dom/props';
import { requiresSanitization, sanitizeAttributeValue } from '../../dom/sanitized-values';
import type { ServerTreeBuilder } from '../../dom/tree-builder';

export function dynamicAttribute(
  dom: TreeBuilder,
  tagName: string,
  attributeName: string,
  isTrusting = false
): DynamicAttribute {
  if (dom.type === 'server') {
    return buildDynamicAttribute({ tag: tagName, name: attributeName, normalized: attributeName });
  }

  let attribute: AttributeCursor = { tag: tagName, name: attributeName, normalized: attributeName };

  if (import.meta.env.DEV && attributeName === 'style' && !isTrusting) {
    return new DebugStyleAttributeManager(attribute);
  }

  // TODO [2023/06/05] Fix after everything else works
  // if (namespaceURI === NS_SVG) {
  //   return buildDynamicAttribute(tagName, attributeName, attribute);
  // }

  let [type, normalized] = normalizeProperty(document.createElement(tagName), attributeName);
  attribute.normalized = normalized;

  return type === ATTR ? buildDynamicAttribute(attribute) : buildDynamicProperty(attribute);
}

function buildDynamicAttribute(attribute: AttributeCursor): DynamicAttribute {
  return requiresSanitization(attribute.tag, attribute.name)
    ? new SafeDynamicAttribute(attribute)
    : new SimpleDynamicAttribute(attribute);
}

function buildDynamicProperty(attribute: AttributeCursor): DynamicAttribute {
  let { name, tag } = attribute;
  let tagName = tag.toUpperCase();
  if (requiresSanitization(tagName, name)) {
    return new SafeDynamicProperty(name, attribute);
  }

  if (isUserInputValue(tagName, name)) {
    return new InputValueDynamicAttribute(name, attribute);
  }

  if (isOptionSelected(tagName, name)) {
    return new OptionSelectedDynamicAttribute(name, attribute);
  }

  return new DefaultDynamicProperty(name, attribute);
}

export abstract class DynamicAttribute implements AttributeOperation {
  constructor(public attribute: AttributeCursor) {}

  abstract server(dom: ServerTreeBuilderInterface, value: unknown): void;
  abstract client(dom: BrowserTreeBuilderInterface, value: unknown): AttributeRef | PropRef;
  rehydrate(_dom: BrowserTreeBuilderInterface, _element: Element, _value: unknown): void {
    throw new Error(`Method not implemented (${this.constructor.name}#rehydrate).`);
  }
  abstract update(element: Element, value: unknown): void;
}

export class SimpleDynamicAttribute extends DynamicAttribute {
  server(dom: ServerTreeBuilder, value: unknown) {
    dom.addAttr(this.attribute.name, value);
  }

  client(dom: BrowserTreeBuilderInterface, value: unknown): AttributeRef {
    let normalizedValue = normalizeValue(value);

    let { name } = this.attribute;
    return dom.addAttr(name, normalizedValue);
  }

  update(element: Element, value: unknown): void {
    let normalizedValue = normalizeValue(value);
    let { name } = this.attribute;

    if (normalizedValue === null) {
      element.removeAttribute(name);
    } else {
      element.setAttribute(name, normalizedValue);
    }
  }
}

export class DefaultDynamicProperty extends DynamicAttribute {
  #lastValue: unknown;

  constructor(private normalizedName: string, attribute: AttributeCursor) {
    super(attribute);
  }

  override server(dom: ServerTreeBuilderInterface, value: unknown): void {
    let normalizedValue = normalizeValue(value);

    if (normalizedValue !== null) {
      let { name } = this.attribute;
      dom.addAttr(name, normalizedValue);
    }
  }

  override client(dom: BrowserTreeBuilderInterface, value: unknown) {
    this.#lastValue = value;
    return dom.addProp(this.normalizedName, (element) => {
      if (value != null) Reflect.set(element, this.attribute.name, value);
    });
  }

  update(element: Element, value: unknown): void {
    if (this.#lastValue !== value) {
      (element as any)[this.normalizedName] = this.#lastValue = value;

      if (value === null || value === undefined) {
        this.removeAttribute(element);
      }
    }
  }

  protected removeAttribute(element: Element) {
    // TODO this sucks but to preserve properties first and to meet current
    // semantics we must do this.
    element.removeAttribute(this.normalizedName);
  }
}

export class SafeDynamicProperty extends DefaultDynamicProperty {
  override server(dom: ServerTreeBuilderInterface, value: unknown): void {
    let { name } = this.attribute;
    let sanitized = sanitizeAttributeValue(this.attribute.tag.toUpperCase(), name, value);
    super.server(dom, sanitized);
  }

  override client(dom: BrowserTreeBuilderInterface, value: unknown): PropRef {
    let { name } = this.attribute;
    let sanitized = sanitizeAttributeValue(this.attribute.tag.toUpperCase(), name, value);
    return super.client(dom, sanitized);
  }

  override update(element: Element, value: unknown): void {
    let { name } = this.attribute;
    let sanitized = sanitizeAttributeValue(this.attribute.tag.toUpperCase(), name, value);
    super.update(element, sanitized);
  }
}

export class SafeDynamicAttribute extends SimpleDynamicAttribute {
  override client(dom: BrowserTreeBuilderInterface, value: unknown): AttributeRef {
    let { name } = this.attribute;
    let sanitized = sanitizeAttributeValue(this.attribute.tag.toUpperCase(), name, value);
    return super.client(dom, sanitized);
  }

  override update(element: Element, value: unknown): void {
    let { name } = this.attribute;
    let sanitized = sanitizeAttributeValue(this.attribute.tag.toUpperCase(), name, value);
    super.update(element, sanitized);
  }
}

export class InputValueDynamicAttribute extends DefaultDynamicProperty {
  override client(dom: BrowserTreeBuilderInterface, value: unknown): PropRef {
    return dom.addProp('value', (element) =>
      Reflect.set(element, 'value', normalizeStringValue(value))
    );
  }

  override server(dom: ServerTreeBuilderInterface, value: unknown): void {
    dom.addAttr('value', normalizeStringValue(value));
  }

  override update(element: Element, value: unknown): void {
    let input = castToBrowser(element, ['input', 'textarea']);
    let currentValue = input.value;
    let normalizedValue = normalizeStringValue(value);
    if (currentValue !== normalizedValue) {
      input.value = normalizedValue;
    }
  }
}

export class OptionSelectedDynamicAttribute extends DefaultDynamicProperty {
  override client(dom: BrowserTreeBuilderInterface, value: unknown) {
    return dom.addProp('selected', (element) => Reflect.set(element, 'selected', value));
  }

  override update(element: Element, value: unknown): void {
    let option = castToBrowser(element, 'option');

    option.selected = value ? true : false;
  }
}

function isOptionSelected(tagName: string, attribute: string) {
  return tagName === 'OPTION' && attribute === 'selected';
}

function isUserInputValue(tagName: string, attribute: string) {
  return (tagName === 'INPUT' || tagName === 'TEXTAREA') && attribute === 'value';
}

function normalizeValue(value: unknown): Nullable<string> {
  if (
    value === false ||
    value === undefined ||
    value === null ||
    (value as Dict).toString === undefined
  ) {
    return null;
  }
  if (value === true) {
    return '';
  }
  // onclick function etc in SSR
  if (typeof value === 'function') {
    return null;
  }

  return String(value);
}

let DebugStyleAttributeManager: {
  new (attribute: AttributeCursor): AttributeOperation & DynamicAttribute;
};

if (import.meta.env.DEV) {
  DebugStyleAttributeManager = class extends SimpleDynamicAttribute {
    override client(dom: BrowserTreeBuilderInterface, value: unknown) {
      warnIfStyleNotTrusted(value);
      return super.client(dom, value);
    }

    override update(element: Element, value: unknown): void {
      warnIfStyleNotTrusted(value);
      super.update(element, value);
    }
  };
}
