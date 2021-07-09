import { InternalComponentCapabilities, InternalComponentManager } from '@glimmer/interfaces';
import { CurriedType, Dict, Maybe } from '@glimmer/interfaces';
import { createComputeRef, NULL_REFERENCE, Reference, valueForRef } from '@glimmer/reference';
import { setInternalComponentManager } from '@glimmer/manager';
import { curry } from '../curried-value';

const CAPABILITIES: InternalComponentCapabilities = {
  dynamicLayout: false,
  dynamicTag: false,
  prepareArgs: false,
  createArgs: false,
  attributeHook: false,
  elementHook: false,
  createCaller: false,
  dynamicScope: false,
  updateHook: false,
  createInstance: false,
  wrapped: false,
  willDestroy: false,
  hasSubOwner: false,
};

export class DynamicElementManager implements InternalComponentManager {
  getCapabilities(): InternalComponentCapabilities {
    return CAPABILITIES;
  }

  getDebugName({ tagName }: DynamicElementComponentDefinition): string {
    return tagName;
  }

  getSelf(): Reference {
    return NULL_REFERENCE;
  }

  getDestroyable(): null {
    return null;
  }
}

export const DYNAMIC_ELEMENT_MANAGER = new DynamicElementManager();

class DynamicElementComponentDefinition {
  constructor(public tagName: string) {}
}

setInternalComponentManager(DYNAMIC_ELEMENT_MANAGER, DynamicElementComponentDefinition.prototype);

export default function createDynamicElementRef(tagName: Reference) {
  let lastValue: Maybe<Dict> | string, curriedDefinition: object | string | null;

  return createComputeRef(() => {
    let value = valueForRef(tagName) as string;

    if (value === lastValue) {
      return curriedDefinition;
    }

    lastValue = value;
    curriedDefinition = curry(
      CurriedType.Component,
      new DynamicElementComponentDefinition(value),
      {},
      null,
      false
    );

    return curriedDefinition;
  });
}
