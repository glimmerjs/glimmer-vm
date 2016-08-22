import { FIXME, Opaque } from 'glimmer-util';
import { DOMNamespace } from './helper';
import * as Simple from './interfaces';
import {
  sanitizeAttributeValue,
  requiresSanitization
} from './sanitized-values';
import { normalizeProperty, normalizePropertyValue } from './props';
import { SVG_NAMESPACE } from './helper';
import { normalizeTextValue } from '../compiled/opcodes/content';
import { Environment } from '../environment';

export function defaultPropertyManagers(tagName: string, attr: string) {
  if (requiresSanitization(tagName, attr)) {
    return new SafeHrefPropertyManager(attr);
  }

  if (isUserInputValue(tagName, attr)) {
    return new InputValuePropertyManager(attr);
  }

  if (isOptionSelected(tagName, attr)) {
    return new OptionSelectedManager(attr);
  }

  return new PropertyManager(attr);
}

export function defaultAttributeManagers(tagName: string, attr: string) {
  if (requiresSanitization(tagName, attr)) {
    return new SafeHrefAttributeManager(attr);
  }

  return new AttributeManager(attr);
}

export function readDOMAttr(element: Element, attr: string) {
   let isSVG = element.namespaceURI === SVG_NAMESPACE;
   let { type, name } = normalizeProperty(element, attr);

   if (isSVG) {
     return element.getAttribute(name);
   }

   if (type === 'attr') {
     return element.getAttribute(name);
   } else {
     return element[name];
   }
};

export class AttributeManager {
  constructor(public name: string) {}
  setAttribute(env: Environment, element: Simple.Element, value: Opaque, namespace?: DOMNamespace) {
    let dom = env.getAppendOperations();

    if (value !== null && value !== undefined) {
      dom.setAttribute(element, this.name, normalizeTextValue(value), namespace);
    }
  }

  updateAttribute(env: Environment, element: Element, value: Opaque, namespace?: DOMNamespace) {
    if (value === null) {
      if (namespace) {
        env.getDOM().removeAttributeNS(element, namespace, this.name);
      } else {
        env.getDOM().removeAttribute(element, this.name);
      }
    } else {
      this.setAttribute(env, element, value, namespace);
    }
  }
}

export class PropertyManager extends AttributeManager {
  setAttribute(env: Environment, element: Simple.Element, value: Opaque, namespace?: DOMNamespace) {
    if (value !== null) {
      element[this.name] = normalizePropertyValue(value); // TODO: This doesn't work
    }
  }

  updateAttribute(env: Environment, element: Element, value: Opaque, namespace?: DOMNamespace) {
    if (value === null) {
      element[this.name] = value;
    } else {
      this.setAttribute(env, element, value, namespace);
    }
  }
}

function isUserInputValue(tagName: string, attribute: string) {
  return (tagName === 'INPUT' || tagName === 'TEXTAREA') && attribute === 'value';
}

export class InputValuePropertyManager extends PropertyManager {
  setAttribute(env: Environment, element: Simple.Element, value: Opaque) {
    let input = element as FIXME<HTMLInputElement, "This breaks SSR">;
    input.value = normalizeTextValue(value);
  }

  updateAttribute(env: Environment, element: Element, value: Opaque) {
    let input = <HTMLInputElement>element;
    let currentValue = input.value;
    let normalizedValue = normalizeTextValue(value);
    if (currentValue !== normalizedValue) {
      input.value = normalizedValue;
    }
  }
}

function isOptionSelected(tagName: string, attribute: string) {
  return tagName === 'OPTION' && attribute === 'selected';
}

export class OptionSelectedManager extends PropertyManager {
  setAttribute(env: Environment, element: Simple.Element, value: Opaque) {
    if (value !== null && value !== undefined && value !== false) {
      env.getAppendOperations().setAttribute(element, 'selected', '');
    }
  }

  updateAttribute(env: Environment, element: Element, value: Opaque) {
    let option = <HTMLOptionElement>element;

    if (value === null || value === undefined || value === false) {
      option.selected = false;
    } else {
      option.selected = true;
    }
  }
}

export class SafeHrefPropertyManager extends PropertyManager {
  setAttribute(env: Environment, element: Simple.Element, value: Opaque) {
    super.setAttribute(env, element, sanitizeAttributeValue(env, element, this.name, value));
  }

  updateAttribute(env: Environment, element: Element, value: Opaque) {
    this.setAttribute(env, element, value);
  }
}

export class SafeHrefAttributeManager extends AttributeManager {
  setAttribute(env: Environment, element: Element, value: Opaque) {
    super.setAttribute(env, element, sanitizeAttributeValue(env, element, this.name, value));
  }

  updateAttribute(env: Environment, element: Element, attr: string, value: Opaque) {
    this.setAttribute(env, element, value);
  }
};
