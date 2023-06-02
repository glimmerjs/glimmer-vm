import type { TreeBuilder } from '../..';
import type { Nullable } from '../core';
import type { Reference } from '../references';

export interface DomTypes {
  vm: unknown;
  opcodes: unknown;
  addModifierFn?: (...args: any[]) => unknown;
  treeBuilder: TreeBuilder;
}

export interface ElementBuffer {
  attr: (attributeName: string, attributeValue?: string | boolean) => void;
  flush: () => string;
}

export interface ElementOperations<D extends DomTypes> {
  flush(vm: D['vm']): D['opcodes'];
  setAttribute(
    name: string,
    value: Reference,
    trusting: boolean,
    namespace: Nullable<string>
  ): void;
  setStaticAttribute(name: string, value: string, namespace: Nullable<string>): void;
  addModifier?: D['addModifierFn'];
}
