import type { Dict, SimpleElement } from '@glimmer/interfaces';

/*
 * @method normalizeProperty
 * @param element {HTMLElement}
 * @param slotName {String}
 * @returns {Object} { name, type }
 */
export function normalizeProperty(element: SimpleElement, slotName: string) {
  let type, normalized;

  if (slotName in element) {
    normalized = slotName;
    type = 'prop';
  } else {
    let lower = slotName.toLowerCase();
    if (lower in element) {
      type = 'prop';
      normalized = lower;
    } else {
      type = 'attr';
      normalized = slotName;
    }
  }

  if (
    type === 'prop' &&
    (normalized.toLowerCase() === 'style' || preferAttr(element.tagName, normalized))
  ) {
    type = 'attr';
  }

  return { normalized, type };
}

export function normalizePropertyValue(value: unknown): unknown {
  if (value === '') {
    return true;
  }

  return value;
}

// properties that MUST be set as attributes, due to:
// * browser bug
// * strange spec outlier
const ATTR_OVERRIDES: Dict<string | string[]> = {
  INPUT: [
    'form',
    // Chrome 46.0.2464.0: 'autocorrect' in document.createElement('input') === false
    // Safari 8.0.7: 'autocorrect' in document.createElement('input') === false
    // Mobile Safari (iOS 8.4 simulator): 'autocorrect' in document.createElement('input') === true
    'autocorrect',
    // Chrome 54.0.2840.98: 'list' in document.createElement('input') === true
    // Safari 9.1.3: 'list' in document.createElement('input') === false
    'list',
  ],

  // element.form is actually a legitimate readOnly property, that is to be
  // mutated, but must be mutated by setAttribute...
  SELECT: 'form',
  OPTION: 'form',
  TEXTAREA: 'form',
  LABEL: 'form',
  FIELDSET: 'form',
  LEGEND: 'form',
  OBJECT: 'form',
  OUTPUT: 'form',
  BUTTON: 'form',
};

function preferAttr(tagName: string, propName: string) {
  let props = ATTR_OVERRIDES[tagName.toUpperCase()];
  return typeof props === 'string' ? propName === props : props?.includes(propName);
}
