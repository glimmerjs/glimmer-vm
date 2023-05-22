import { warnIfStyleNotTrusted } from '@glimmer/global-context';
import type {
  AttributeCursor,
  AttributeOperation,
  AttrNamespace,
  Dict,
  DOMEnvironment,
  ElementBuilder,
  Environment,
  Nullable,
} from '@glimmer/interfaces';
import { castToBrowser, NS_SVG } from '@glimmer/util';

import { normalizeStringValue } from '../../dom/normalize';
import { ATTR, normalizeProperty } from '../../dom/props';
import { requiresSanitization, sanitizeAttributeValue } from '../../dom/sanitized-values';

export function dynamicAttribute<E extends DOMEnvironment>(
  element: E['element'],
  attributeName: string,
  namespace: Nullable<AttrNamespace>,
  isTrusting = false
): DynamicAttribute<E> {
  let { tagName, namespaceURI } = element;
  let attribute = { element, name: attributeName, namespace };

  if (import.meta.env.DEV && attributeName === 'style' && !isTrusting) {
    return new DebugStyleAttributeManager<E>(attribute);
  }

  if (namespaceURI === NS_SVG) {
    return buildDynamicAttribute(tagName, attributeName, attribute);
  }

  let [type, normalized] = normalizeProperty(element, attributeName);

  return type === ATTR
    ? buildDynamicAttribute(tagName, normalized, attribute)
    : buildDynamicProperty(tagName, normalized, attribute);
}

function buildDynamicAttribute<E extends DOMEnvironment>(
  tagName: string,
  name: string,
  attribute: AttributeCursor<E>
): DynamicAttribute<E> {
  return requiresSanitization(tagName, name)
    ? new SafeDynamicAttribute<E>(attribute)
    : new SimpleDynamicAttribute<E>(attribute);
}

function buildDynamicProperty<E extends DOMEnvironment = DOMEnvironment>(
  tagName: string,
  name: string,
  attribute: AttributeCursor<E>
): DynamicAttribute<E> {
  if (requiresSanitization(tagName, name)) {
    return new SafeDynamicProperty(name, attribute);
  }

  if (isUserInputValue(tagName, name)) {
    return new InputValueDynamicAttribute<E>(name, attribute);
  }

  if (isOptionSelected(tagName, name)) {
    return new OptionSelectedDynamicAttribute<E>(name, attribute);
  }

  return new DefaultDynamicProperty(name, attribute);
}

export abstract class DynamicAttribute<E extends DOMEnvironment = DOMEnvironment>
  implements AttributeOperation<E>
{
  constructor(public attribute: AttributeCursor<E>) {}

  abstract set(dom: ElementBuilder<E>, value: unknown, environment: Environment): void;
  abstract update(value: unknown, environment: Environment): void;
}

export class SimpleDynamicAttribute<
  E extends DOMEnvironment = DOMEnvironment
> extends DynamicAttribute<E> {
  set(dom: ElementBuilder<E>, value: unknown, _environment: Environment): void {
    let normalizedValue = normalizeValue(value);

    if (normalizedValue !== null) {
      let { name, namespace } = this.attribute;
      dom.__setAttribute(name, normalizedValue, namespace);
    }
  }

  update(value: unknown, _environment: Environment): void {
    let normalizedValue = normalizeValue(value);
    let { element, name } = this.attribute;

    if (normalizedValue === null) {
      element.removeAttribute(name);
    } else {
      element.setAttribute(name, normalizedValue);
    }
  }
}

export class DefaultDynamicProperty<
  E extends DOMEnvironment = DOMEnvironment
> extends DynamicAttribute<E> {
  constructor(private normalizedName: string, attribute: AttributeCursor<E>) {
    super(attribute);
  }

  value: unknown;
  set(dom: ElementBuilder<E>, value: unknown, _environment: Environment): void {
    if (value !== null && value !== undefined) {
      this.value = value;
      dom.__setProperty(this.normalizedName, value);
    }
  }

  update(value: unknown, _environment: Environment): void {
    let { element } = this.attribute;

    if (this.value !== value) {
      (element as any)[this.normalizedName] = this.value = value;

      if (value === null || value === undefined) {
        this.removeAttribute();
      }
    }
  }

  protected removeAttribute() {
    // TODO this sucks but to preserve properties first and to meet current
    // semantics we must do this.
    let { element, namespace } = this.attribute;

    if (namespace) {
      element.removeAttributeNS(namespace, this.normalizedName);
    } else {
      element.removeAttribute(this.normalizedName);
    }
  }
}

export class SafeDynamicProperty<
  E extends DOMEnvironment = DOMEnvironment
> extends DefaultDynamicProperty<E> {
  override set(dom: ElementBuilder<E>, value: unknown, environment: Environment): void {
    let { element, name } = this.attribute;
    let sanitized = sanitizeAttributeValue(element, name, value);
    super.set(dom, sanitized, environment);
  }

  override update(value: unknown, environment: Environment): void {
    let { element, name } = this.attribute;
    let sanitized = sanitizeAttributeValue(element, name, value);
    super.update(sanitized, environment);
  }
}

export class SafeDynamicAttribute<
  E extends DOMEnvironment = DOMEnvironment
> extends SimpleDynamicAttribute<E> {
  override set(dom: ElementBuilder<E>, value: unknown, environment: Environment): void {
    let { element, name } = this.attribute;
    let sanitized = sanitizeAttributeValue(element, name, value);
    super.set(dom, sanitized, environment);
  }

  override update(value: unknown, environment: Environment): void {
    let { element, name } = this.attribute;
    let sanitized = sanitizeAttributeValue(element, name, value);
    super.update(sanitized, environment);
  }
}

export class InputValueDynamicAttribute<
  E extends DOMEnvironment = DOMEnvironment
> extends DefaultDynamicProperty<E> {
  override set(dom: ElementBuilder<E>, value: unknown) {
    dom.__setProperty('value', normalizeStringValue(value));
  }

  override update(value: unknown) {
    let input = castToBrowser(this.attribute.element, ['input', 'textarea']);
    let currentValue = input.value;
    let normalizedValue = normalizeStringValue(value);
    if (currentValue !== normalizedValue) {
      input.value = normalizedValue;
    }
  }
}

export class OptionSelectedDynamicAttribute<
  E extends DOMEnvironment = DOMEnvironment
> extends DefaultDynamicProperty<E> {
  override set(dom: ElementBuilder<E>, value: unknown): void {
    if (value !== null && value !== undefined && value !== false) {
      dom.__setProperty('selected', true);
    }
  }

  override update(value: unknown): void {
    let option = castToBrowser(this.attribute.element, 'option');

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
  new <E extends DOMEnvironment = DOMEnvironment>(
    attribute: AttributeCursor<E>
  ): AttributeOperation<E> & DynamicAttribute<E>;
};

if (import.meta.env.DEV) {
  DebugStyleAttributeManager = class<E extends DOMEnvironment> extends SimpleDynamicAttribute<E> {
    override set(dom: ElementBuilder<E>, value: unknown, environment: Environment): void {
      warnIfStyleNotTrusted(value);

      super.set(dom, value, environment);
    }
    override update(value: unknown, environment: Environment): void {
      warnIfStyleNotTrusted(value);

      super.update(value, environment);
    }
  };
}
