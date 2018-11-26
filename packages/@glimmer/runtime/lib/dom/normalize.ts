import { Simple, UserValue } from '@glimmer/interfaces';

export interface SafeString {
  toHTML(): string;
}

export type Insertion = CautiousInsertion | TrustingInsertion;
export type CautiousInsertion = string | SafeString | Simple.Node;
export type TrustingInsertion = string | Simple.Node;

export function normalizeStringValue(value: UserValue): string {
  if (isEmpty(value)) {
    return '';
  }
  return String(value);
}

export function normalizeTrustedValue(value: UserValue): TrustingInsertion {
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

export function shouldCoerce(value: UserValue) {
  return (
    isString(value) || isEmpty(value) || typeof value === 'boolean' || typeof value === 'number'
  );
}

export function isEmpty(value: UserValue | string): boolean {
  return value === null || value === undefined || typeof value.toString !== 'function';
}

export function isSafeString(value: unknown): value is SafeString {
  return typeof value === 'object' && value !== null && typeof (value as any).toHTML === 'function';
}

export function isNode(value: unknown): value is Simple.Node {
  return typeof value === 'object' && value !== null && typeof (value as any).nodeType === 'number';
}

export function isFragment(value: unknown): value is Simple.DocumentFragment {
  return isNode(value) && value.nodeType === 11;
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}
