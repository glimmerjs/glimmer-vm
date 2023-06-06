import type { SimpleElement } from '@glimmer/interfaces';
import { NS_MATHML, NS_SVG } from '@glimmer/util';

export const ATTR = 0;
export const PROP = 1;
export type AttrType = 0 | 1;
export type NormalizedProperty = [type: AttrType, normalized: string];

export function normalizeProperty(
  element: Element | SimpleElement,
  slotName: string
): NormalizedProperty {
  if (element.namespaceURI === NS_SVG || element.namespaceURI === NS_MATHML)
    return [ATTR, slotName];

  if (
    isConstrainableElement(element.tagName) &&
    !isBooleanAttribute(slotName) &&
    slotName !== 'value'
  ) {
    return [ATTR, slotName.toLowerCase()];
  }

  if (slotName in element) return triage(element, slotName);

  let lower = slotName.toLowerCase();
  return lower in element ? triage(element, lower) : [ATTR, slotName];
}

const CONSTRAINABLE_ELEMENTS = new Set(`INPUT SELECT TEXTAREA`.split(' '));
const CONSTRAINT_ATTRS = new Set(`min max step pattern minlength maxlength required`.split(' '));
const BOOLEAN_ATTRS = new Set('checked disabled multiple'.split(' '));

function isBooleanAttribute(name: string) {
  return BOOLEAN_ATTRS.has(name);
}

function isConstrainableElement(tagName: string) {
  return CONSTRAINABLE_ELEMENTS.has(tagName);
}

function isConstraintAttr(name: string) {
  return CONSTRAINT_ATTRS.has(name);
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
