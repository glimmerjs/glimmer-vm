import type { DOMEnvironment, SimpleElement } from '@glimmer/interfaces';

export const ATTR = 0;
export const PROP = 1;
export type AttrType = 0 | 1;
export type NormalizedProperty = [type: AttrType, normalized: string];

export function normalizeProperty<E extends DOMEnvironment>(
  element: Element | SimpleElement,
  slotName: string
): NormalizedProperty {
  if (slotName in element) return triage(element, slotName);

  let lower = slotName.toLowerCase();
  return lower in element ? triage(element, lower) : [ATTR, slotName];
}

function triage(
  element: Element | SimpleElement,
  normalized: string
): [type: AttrType, normalized: string] {
  return [triageType(element, normalized), normalized];
}

function triageType(element: Element | SimpleElement, normalized: string): AttrType {
  return normalized.toLowerCase() === 'style' || preferAttribute(element.tagName, normalized)
    ? ATTR
    : PROP;
}

export function normalizePropertyValue(value: unknown): unknown {
  if (value === '') {
    return true;
  }

  return value;
}

const FORM = 'INPUT|SELECT|OPTION|TEXTAREA|LABEL|FIELDSET|LEGEND|OBJECT|OUTPUT|BUTTON'.split('|');

function preferAttribute(tagName: string, propertyName: string) {
  if (propertyName === 'form') return FORM.includes(tagName);
  if (tagName === 'INPUT') return propertyName === 'autocorrect' || propertyName === 'list';
}
