import type { Nullable } from '../core';
import type { SomeReactive } from '../references';

export interface ElementOperations {
  setAttribute(name: string, value: SomeReactive, trusting: boolean, namespace: Nullable<string>): void;

  setStaticAttribute(name: string, value: string, namespace: Nullable<string>): void;
}
