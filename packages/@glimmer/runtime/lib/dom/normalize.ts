import type { Dict, SimpleDocumentFragment, SimpleNode } from '@glimmer/interfaces';

interface SafeString {
  toHTML(): string;
}

export function normalizeStringValue(value: unknown): string {
  if (isEmpty(value)) {
    return '';
  }
  return String(value);
}

export function shouldCoerce(
  value: unknown
): value is string | number | boolean | null | undefined {
  return (
    isString(value) || isEmpty(value) || typeof value === 'boolean' || typeof value === 'number'
  );
}

export function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || typeof (value as Dict).toString !== 'function';
}

export function isSafeString(value: unknown): value is SafeString {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof value === 'object' && value !== null && typeof (value as any).toHTML === 'function';
}

export function isNode(value: unknown): value is SimpleNode {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof value === 'object' && value !== null && typeof (value as any).nodeType === 'number';
}

export function isFragment(value: unknown): value is SimpleDocumentFragment {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
  return isNode(value) && value.nodeType === 11;
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}
