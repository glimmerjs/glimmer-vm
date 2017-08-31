import { Simple, Option, Opaque, NodeTokens, NodeToken } from "@glimmer/interfaces";
import Environment from '../../environment';
import { ElementBuilder } from '../element-builder';
import { sanitizeAttributeValue, requiresSanitization } from '../../dom/sanitized-values';
import { normalizeProperty } from '../../dom/props';
import { SVG_NAMESPACE } from '../../dom/helper';
import { AppendAttribute, UpdateAttribute, AttributeOperation } from './index';
import { normalizeStringValue } from '../../dom/normalize';

export interface DynamicAttributeFactory {
  new(attribute: AppendAttribute): DynamicAttribute;
}

export function defaultDynamicAttributes(document: Simple.Document, tag: string, namespace: Simple.Namespace, attr: string): DynamicAttributeFactory {
  if (namespace === SVG_NAMESPACE) {
    return defaultDynamicAttribute(tag, attr);
  }

  let { type, normalized } = normalizeProperty(tag, namespace, attr, document);

  if (type === 'attr') {
    return defaultDynamicAttribute(tag, normalized);
  } else {
    return defaultDynamicProperty(tag, normalized);
  }
}

export function defaultDynamicAttribute(tagName: string, name: string): DynamicAttributeFactory {
  if (requiresSanitization(tagName, name)) {
    return SafeDynamicAttribute;
  } else {
    return SimpleDynamicAttribute;
  }
}

export function defaultDynamicProperty(tagName: string, name: string): DynamicAttributeFactory {
  if (requiresSanitization(tagName, name)) {
    return SafeDynamicProperty;
  }

  if (isUserInputValue(tagName, name)) {
    return InputValueDynamicAttribute;
  }

  if (isOptionSelected(tagName, name)) {
    return OptionSelectedDynamicAttribute;
  }

  return DefaultDynamicProperty;
}

export abstract class DynamicAttribute implements AttributeOperation {
  protected element: Option<Simple.Element> = null;

  constructor(public attribute: AppendAttribute) {}

  abstract set(dom: ElementBuilder, value: Opaque, env: Environment): void;
  abstract update(value: Opaque, env: Environment): void;
  abstract reify(tokens: NodeTokens): void;
}

export class SimpleDynamicAttribute extends DynamicAttribute {
  set(dom: ElementBuilder, value: Opaque, _env: Environment): void {
    let normalizedValue = normalizeValue(value);

    if (normalizedValue !== null) {
      let { name, namespace } = this.attribute;
      dom.setAttribute(name, normalizedValue, namespace || undefined);
    }
  }

  update(value: Opaque, _env: Environment): void {
    let normalizedValue = normalizeValue(value);
    let { name } = this.attribute;
    let element = this.element!;

    if (normalizedValue === null) {
      element.removeAttribute(name);
    } else {
      element.setAttribute(name, normalizedValue);
    }
  }

  reify(tokens: NodeTokens) {
    this.element = tokens.reify(this.attribute.element) as Simple.Element;
  }
}

export class DefaultDynamicProperty extends DynamicAttribute {
  set(dom: ElementBuilder, value: Opaque, _env: Environment): void {
    if (value !== null && value !== undefined) {
      let { name } = this.attribute;
      dom.__setProperty(name, value);
    }
  }

  update(value: Opaque, _env: Environment): void {
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

export class SafeDynamicProperty extends DefaultDynamicProperty {
  set(dom: ElementBuilder, value: Opaque, env: Environment): void {
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

export class SafeDynamicAttribute extends SimpleDynamicAttribute {
  set(dom: ElementBuilder, value: Opaque, env: Environment): void {
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

export class InputValueDynamicAttribute extends DefaultDynamicProperty {
  set(dom: ElementBuilder, value: Opaque) {
    dom.__setProperty('value', normalizeStringValue(value));
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

export class OptionSelectedDynamicAttribute extends DefaultDynamicProperty {
  set(dom: ElementBuilder, value: Opaque): void {
    if (value !== null && value !== undefined && value !== false) {
      dom.__setProperty('selected', true);
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

function normalizeValue(value: Opaque): Option<string> {
  if (value === false || value === undefined || value === null || typeof value.toString === 'undefined') {
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
