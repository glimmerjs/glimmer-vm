import type { SimpleElement } from '@glimmer/interfaces';

export const ATTR = 0;
export const PROP = 1;
export type AttrType = 0 | 1;
export type NormalizedProperty = [type: AttrType, normalized: string];

export function normalizeProperty(element: SimpleElement, slotName: string): NormalizedProperty {
  if (slotName in element) return triage(element, slotName);

  let lower = slotName.toLowerCase();
  if (lower in element) {
    return triage(element, lower);
  } else {
    return [ATTR, slotName];
  }
}

function triage(element: SimpleElement, normalized: string): [type: AttrType, normalized: string] {
  return [triageType(element, normalized), normalized];
}

function triageType(element: SimpleElement, normalized: string): AttrType {
  return normalized.toLowerCase() === 'style' || preferAttr(element.tagName, normalized)
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

function preferAttr(tagName: string, propName: string) {
  if (propName === 'form') return FORM.includes(tagName);
  if (tagName === 'INPUT') return propName === 'autocorrect' || propName === 'list';
}
