import { Simple, Option, Opaque, FIXME } from "@glimmer/interfaces";
import Environment from '../../environment';
import { NewElementBuilder as DOM } from '../element-builder';
import { sanitizeAttributeValue, requiresSanitization } from '../../dom/sanitized-values';
import { normalizeProperty } from '../../dom/props';
import { SVG_NAMESPACE } from '../../dom/helper';

export interface Attribute {
  element: Simple.Element;
  name: string;
  namespace: Option<string>;
}

export interface DynamicAttributeFactory {
  new(attribute: Attribute): DynamicAttribute;
}

export function defaultDynamicAttributes(element: Simple.Element, attr: string): DynamicAttributeFactory {
  let { tagName, namespaceURI } = element;

  if (namespaceURI === SVG_NAMESPACE) {
    return defaultDynamicAttribute(tagName, attr);
  }

  let { type, normalized } = normalizeProperty(element, attr);

  if (type === 'attr') {
    return defaultDynamicAttribute(tagName, normalized);
  } else {
    return defaultDynamicProperty(tagName, normalized);
  }
}

export function defaultDynamicAttribute(tagName: string, name: string): DynamicAttributeFactory {
  if (requiresSanitization(tagName, name)) {
    return SafeDefaultDynamicAttribute;
  } else {
    return DefaultDynamicAttribute;
  }
}

export function defaultDynamicProperty(tagName: string, name: string): DynamicAttributeFactory {
  if (requiresSanitization(tagName, name)) {
    return SafeDefaultDynamicAttribute;
  }

  if (isUserInputValue(tagName, name)) {
    return InputValueDynamicAttribute;
  }

  if (isOptionSelected(tagName, name)) {
    return OptionSelectedDynamicAttribute;
  }

  return DefaultDynamicAttribute;
}

export abstract class DynamicAttribute {
  constructor(public attribute: Attribute) {}

  abstract set(dom: DOM, value: Opaque, env: Environment): void;
  abstract update(value: Opaque, env: Environment): void;
}

export class SimpleDynamicAttribute extends DynamicAttribute {
  set(dom: DOM, value: Opaque): void {
    let normalizedValue = normalizeStringValue(value);

    if (normalizedValue !== null) {
      dom.__setAttribute(this.attribute.name, normalizedValue);
    }
  }

  update(value: Opaque): void {
    let normalizedValue = normalizeStringValue(value);
    let { element, name } = this.attribute;

    if (normalizedValue === null) {
      element.removeAttribute(name);
    } else {
      element.setAttribute(name, normalizedValue);
    }
  }
}

export class NamespacedDynamicAttribute extends DynamicAttribute {
  set(dom: DOM, value: Opaque): void {
    let normalizedValue = normalizeStringValue(value);

    if (normalizedValue !== null) {
      dom.__setAttributeNS(this.attribute.name, normalizedValue, this.attribute.namespace!);
    }
  }

  update(value: Opaque): void {
    let normalizedValue = normalizeStringValue(value);
    let { element, name, namespace } = this.attribute;

    if (normalizedValue === null) {
      element.removeAttributeNS(namespace!, name);
    } else {
      element.setAttributeNS(namespace!, name, normalizedValue);
    }
  }
}

export class DefaultDynamicAttribute extends DynamicAttribute {
  set(dom: DOM, value: Opaque, env: Environment): void {
    if (value !== null && value !== undefined) {
      let { element, name } = this.attribute;
      element[name] = value;
    }
  }

  update(value: Opaque, env: Environment): void {
    let { element, name } = this.attribute;

    element[name] = value;

    if (value === null || value === undefined) {
      this.removeAttribute();
    }
  }

  protected removeAttribute() {
    // TODO this sucks but to preserve properties first and to meet current
    // semantics we must do this.
    let { element, name, namespace } = this.attribute;

    if (namespace) {
      element.removeAttributeNS(namespace, name);
    } else {
      element.removeAttribute(name);
    }
  }
}

export class SafeDefaultDynamicAttribute extends DefaultDynamicAttribute {
  set(dom: DOM, value: Opaque, env: Environment): void {
    let { element, name } = this.attribute;
    let sanitized = sanitizeAttributeValue(env, element, name, value);
    super.set(dom, sanitized, env);
  }

  update(value: Opaque, env: Environment): void {
    let { element, name } = this.attribute;
    let sanitized = sanitizeAttributeValue(env, element, name, value);
    super.update(sanitized, env);
  }
}

export class InputValueDynamicAttribute extends DefaultDynamicAttribute {
  set(dom: DOM, value: Opaque) {
    let input = this.attribute.element as FIXME<HTMLInputElement, "This breaks SSR">;
    input.value = normalizeStringValue(value)!;
  }

  update(value: Opaque) {
    let input = <HTMLInputElement>this.attribute.element;
    let currentValue = input.value;
    let normalizedValue = normalizeStringValue(value);
    if (currentValue !== normalizedValue) {
      input.value = normalizedValue!;
    }
  }
}

export class OptionSelectedDynamicAttribute extends DefaultDynamicAttribute {
  set(dom: DOM, value: Opaque): void {
    if (value !== null && value !== undefined && value !== false) {
      let option = <HTMLOptionElement>this.attribute.element;
      option.selected = true;
    }
  }

  update(value: Opaque): void {
    let option = <HTMLOptionElement>this.attribute.element;

    if (value) {
      option.selected = true;
    } else {
      option.selected = false;
    }
  }
}

function isOptionSelected(tagName: string, attribute: string) {
  return tagName === 'OPTION' && attribute === 'selected';
}

function isUserInputValue(tagName: string, attribute: string) {
  return (tagName === 'INPUT' || tagName === 'TEXTAREA') && attribute === 'value';
}

function normalizeStringValue(value: Opaque): Option<string> {
  if (value === false || value === undefined || value === null) {
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
