import type { Dict, SimpleDocumentFragment, SimpleNode } from '@glimmer/interfaces';

export interface SafeString {
  toHTML(): string;
}

export type Insertion = CautiousInsertion | TrustingInsertion;
export type CautiousInsertion = string | SafeString | SimpleNode;
export type TrustingInsertion = string | SimpleNode;

export function normalizeStringValue(value: unknown): string {
  return isEmpty(value) ? '' : String(value);
}

export function normalizeTrustedValue(value: unknown): TrustingInsertion {
  if (isEmpty(value)) return '';
  if (isString(value) || isNode(value)) return value;
  if (isSafeString(value)) return value.toHTML();

  return String(value);
}

export function shouldCoerce(
  value: unknown
): value is string | number | boolean | null | undefined {
  return isPrimitive(value) || notStringifiable(value);
}

function isPrimitive(value: unknown) {
  if (value == null) return true;

  switch (typeof value) {
    case 'boolean':
    case 'number':
    case 'string':
      return true;
    default:
      return false;
  }
}

export function isEmpty(value: unknown): boolean {
  return value == null || notStringifiable(value);
}

export function notStringifiable(value: unknown): boolean {
  return typeof (value as Dict).toString !== 'function';
}

export function isSafeString(value: unknown): value is SafeString {
  return typeof value === 'object' && value !== null && typeof (value as any).toHTML === 'function';
}

export function isNode(value: unknown): value is SimpleNode {
  return typeof value === 'object' && value !== null && typeof (value as any).nodeType === 'number';
}

export function isFragment(value: SimpleNode): value is SimpleDocumentFragment {
  return value.nodeType === 11;
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}
