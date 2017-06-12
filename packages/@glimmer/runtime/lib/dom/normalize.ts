import { Opaque } from "@glimmer/interfaces";

export interface SafeString {
  toHTML(): string;
}

export type Insertion = CautiousInsertion | TrustingInsertion;
export type CautiousInsertion = string | SafeString | Node;
export type TrustingInsertion = string | Node;

export function normalizeStringValue(value: Opaque): string {
  if (isEmpty(value)) {
    return '';
  }
  return String(value);
}

export function normalizeTrustedValue(value: Opaque): TrustingInsertion {
  if (isEmpty(value)) {
    return '';
  }
  if (isString(value)) {
    return value;
  }
  if (isSafeString(value)) {
    return value.toHTML();
  }
  if (isNode(value)) {
    return value;
  }
  return String(value);
}

export function normalizeValue(value: Opaque): CautiousInsertion {
  if (isEmpty(value)) {
    return '';
  }
  if (isString(value)) {
    return value;
  }
  if (isSafeString(value) || isNode(value)) {
    return value;
  }
  return String(value);
}

export function isEmpty(value: Opaque): boolean {
  return value === null || value === undefined || typeof value.toString !== 'function';
}

export function isSafeString(value: Opaque): value is SafeString {
  return typeof value === 'object' && value !== null && typeof (value as any).toHTML === 'function';
}

export function isNode(value: Opaque): value is Node {
  return typeof value === 'object' && value !== null && typeof (value as any).nodeType === 'number';
}

export function isString(value: Opaque): value is string {
  return typeof value === 'string';
}
