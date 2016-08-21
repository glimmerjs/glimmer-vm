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

export interface IAttributeManager {
  setAttribute(env: Environment, element: Simple.Element, attr: string, value: Opaque, namespace?: string): void;
  updateAttribute(env: Environment, element: Element, attr: string, value: Opaque, namespace?: string): void;
}

export function defaultPropertyManagers(tagName: string, attr: string) {
  if (requiresSanitization(tagName, attr)) {
    return SafeHrefPropertyManager;
  }

  if (isUserInputValue(tagName, attr)) {
    return InputValuePropertyManager;
  }

  if (isOptionSelected(tagName, attr)) {
    return OptionSelectedManager;
  }

  return PropertyManager;
}

export function defaultAttributeManagers(tagName: string, attr: string) {
  if (requiresSanitization(tagName, attr)) {
    return SafeHrefAttributeManager;
  }

  return AttributeManager;
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

export const PropertyManager: IAttributeManager = {
  setAttribute(env: Environment, element: Simple.Element, attr: string, value: Opaque, namespace?: DOMNamespace) {
    if (value !== null) {
      element[attr] = normalizePropertyValue(value); // TODO: This doesn't work
    }
  },

  updateAttribute(env: Environment, element: Element, attr: string, value: Opaque, namespace?: DOMNamespace) {
    if (value === null) {
      element[attr] = value;
    } else {
      this.setAttribute(...arguments);
    }
  }
};

export const AttributeManager: IAttributeManager = new class {
  setAttribute(env: Environment, element: Simple.Element, attr: string, value: Opaque, namespace?: DOMNamespace) {
    let dom = env.getAppendOperations();

    if (value !== null && value !== undefined) {
      dom.setAttribute(element, attr, normalizeTextValue(value), namespace);
    }
  }

  updateAttribute(env: Environment, element: Element, attr: string, value: Opaque, namespace?: DOMNamespace) {
    if (value === null) {
      if (namespace) {
        env.getDOM().removeAttributeNS(element, namespace, attr);
      } else {
        env.getDOM().removeAttribute(element, attr);
      }
    } else {
      this.setAttribute(env, element, attr, value);
    }
  }
};

function isUserInputValue(tagName: string, attribute: string) {
  return (tagName === 'INPUT' || tagName === 'TEXTAREA') && attribute === 'value';
}

export const InputValuePropertyManager: IAttributeManager = new class {
  setAttribute(env: Environment, element: Simple.Element, attr: string, value: Opaque) {
    let input = element as FIXME<HTMLInputElement, "This breaks SSR">;
    input.value = normalizeTextValue(value);
  }

  updateAttribute(env: Environment, element: Element, attr: string, value: Opaque) {
    let input = <HTMLInputElement>element;
    let currentValue = input.value;
    let normalizedValue = normalizeTextValue(value);
    if (currentValue !== normalizedValue) {
      input.value = normalizedValue;
    }
  }
};

function isOptionSelected(tagName: string, attribute: string) {
  return tagName === 'OPTION' && attribute === 'selected';
}

export const OptionSelectedManager: IAttributeManager = new class {
  setAttribute(env: Environment, element: Simple.Element, attr: string, value: Opaque) {
    if (value !== null && value !== undefined && value !== false) {
      env.getAppendOperations().setAttribute(element, 'selected', '');
    }
  }

  updateAttribute(env: Environment, element: Element, attr: string, value: Opaque) {
    let option = <HTMLOptionElement>element;

    if (value === null || value === undefined || value === false) {
      option.selected = false;
    } else {
      option.selected = true;
    }
  }
};

export const SafeHrefPropertyManager: IAttributeManager = new class {
  setAttribute(env: Environment, element: Simple.Element, attr: string, value: Opaque) {
    let tree = env.getAppendOperations();
    PropertyManager.setAttribute(env, element, attr, sanitizeAttributeValue(env, element, attr, value));
  }

  updateAttribute(env: Environment, element: Element, attr: string, value: Opaque) {
    this.setAttribute(env, element, attr, value);
  }
};

export const SafeHrefAttributeManager: IAttributeManager = new class {
  setAttribute(env: Environment, element: Element, attr: string, value: Opaque) {
    AttributeManager.setAttribute(env, element, attr, sanitizeAttributeValue(env, element, attr, value));
  }

  updateAttribute(env: Environment, element: Element, attr: string, value: Opaque) {
    this.setAttribute(env, element, attr, value);
  }
};
