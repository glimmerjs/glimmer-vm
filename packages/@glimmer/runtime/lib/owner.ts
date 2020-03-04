import { symbol } from '@glimmer/util';

export const OWNER: unique symbol = symbol('OWNER') as any;

export function getOwner<T = unknown>(object: any): T {
  return object[OWNER] as T;
}

export function setOwner(object: any, owner: unknown): void {
  object[OWNER] = owner;
}
