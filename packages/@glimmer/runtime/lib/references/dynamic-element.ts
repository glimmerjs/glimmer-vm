import { CurriedType, Dict, Maybe } from '@glimmer/interfaces';
import { createComputeRef, Reference, valueForRef } from '@glimmer/reference';
import { setInternalComponentManager } from '@glimmer/manager';
import { curry } from '../curried-value';

class DynamicElementComponent {
  constructor(public tagName: string) {}
}

setInternalComponentManager(DYNAMIC_ELEMENT_MANAGER, DynamicElementComponent);

export default function createDynamicElementRef(tagName: Reference) {
  let lastValue: Maybe<Dict> | string, curriedDefinition: object | string | null;

  return createComputeRef(() => {
    let value = valueForRef(tagName) as Maybe<Dict> | string;

    if (value === lastValue) {
      return curriedDefinition;
    }

    lastValue = value;
    curriedDefinition = curry(
      CurriedType.Component,
      new DynamicElementComponent(tagName),
      {},
      null,
      false
    );

    return curriedDefinition;
  });
}
