import { Opaque } from '@glimmer/util';

export interface SafeString {
  toHTML(): string;
}

export function isSafeString(value: Opaque): value is SafeString {
  return !!value && typeof value['toHTML'] === 'function';
}

export function isNode(value: Opaque): value is Node {
  return value !== null && typeof value === 'object' && typeof value['nodeType'] === 'number';
}

export function isString(value: Opaque): value is string {
  return typeof value === 'string';
}

export type Insertion = CautiousInsertion | TrustingInsertion;
export type CautiousInsertion = string | SafeString | Node;
export type TrustingInsertion = string | Node;
