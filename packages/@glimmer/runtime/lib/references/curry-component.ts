import {
  CapturedArguments,
  ComponentDefinition,
  Dict,
  Maybe,
  Optional,
  RuntimeResolver,
} from '@glimmer/interfaces';
import { createComputeRef, Reference, valueForRef } from '@glimmer/reference';
import {
  CurriedComponentDefinition,
  isCurriedComponentDefinition,
} from '../component/curried-component';
import { resolveComponent } from '../component/resolve';

export default function createCurryComponentRef(
  inner: Reference,
  resolver: RuntimeResolver,
  meta: unknown,
  args: Optional<CapturedArguments>
) {
  let lastValue: Maybe<Dict>, lastDefinition: Optional<CurriedComponentDefinition>;

  return createComputeRef(() => {
    let value = valueForRef(inner) as Maybe<Dict>;

    if (value === lastValue) {
      return lastDefinition;
    }

    let definition: Optional<CurriedComponentDefinition | ComponentDefinition> = null;

    if (isCurriedComponentDefinition(value)) {
      definition = value;
    } else if (typeof value === 'string' && value) {
      definition = resolveComponent(resolver, value, meta);
    }

    definition = curry(definition, args);

    lastValue = value;
    lastDefinition = definition;

    return definition;
  });
}

function curry(
  definition: Optional<CurriedComponentDefinition | ComponentDefinition>,
  args: Optional<CapturedArguments>
): Optional<CurriedComponentDefinition> {
  if (!args && isCurriedComponentDefinition(definition)) {
    return definition;
  } else if (!definition) {
    return null;
  } else {
    return new CurriedComponentDefinition(definition, args);
  }
}
