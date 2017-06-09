import { Simple, Option, Opaque, Maybe } from "@glimmer/interfaces";
import Environment from '../../environment';
import { NewElementBuilder as DOM } from '../element-builder';


export interface Attribute {
  element: Simple.Element;
  name: string;
  namespace: Option<string>;
}

export interface IDynamicAttribute {
  attribute: Attribute;
  set(dom: DOM, value: Opaque): void;
  update(env: Environment, value: Opaque): void;
}

abstract class DynamicAttribute implements IDynamicAttribute {
  constructor(public attribute: Attribute) {}

  abstract set(dom: DOM, value: Opaque): void;
  abstract update(value: Opaque): void;
}

class SimpleDynamicAttribute extends DynamicAttribute {
  set(dom: DOM, value: Opaque): void {
    let normalizedValue = normalizeAttributeValue(value);

    if (normalizedValue !== null) {
      dom.__setAttribute(this.attribute.name, normalizedValue);
    }
  }

  update(value: Opaque): void {
    let normalizedValue = normalizeAttributeValue(value);
    let { element, name } = this.attribute;

    if (normalizedValue === null) {
      element.removeAttribute(name);
    } else {
      element.setAttribute(name, normalizedValue);
    }
  }
}

class NamespacedDynamicAttribute extends DynamicAttribute {
  set(dom: DOM, value: Opaque): void {
    let normalizedValue = normalizeAttributeValue(value);

    if (normalizedValue !== null) {
      dom.__setAttributeNS(this.attribute.name, normalizedValue, this.attribute.namespace!);
    }
  }

  update(value: Opaque): void {
    let normalizedValue = normalizeAttributeValue(value);
    let { element, name, namespace } = this.attribute;

    if (normalizedValue === null) {
      element.removeAttributeNS(namespace!, name);
    } else {
      element.setAttributeNS(namespace!, name, normalizedValue);
    }
  }
}

function normalizeAttributeValue(value: Opaque): Option<string> {
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
