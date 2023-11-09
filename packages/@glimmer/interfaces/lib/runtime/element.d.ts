import type { Nullable } from '../core';
import type { Reactive } from '../references';

export interface ElementOperations {
  setAttribute(name: string, value: Reactive, trusting: boolean, namespace: Nullable<string>): void;

  setStaticAttribute(name: string, value: string, namespace: Nullable<string>): void;
}
