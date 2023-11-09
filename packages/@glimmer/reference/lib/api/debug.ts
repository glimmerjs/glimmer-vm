import type { DefaultDescriptionFields, Reactive } from '@glimmer/interfaces';
import { devmode, enhancedDevmode, inDevmode, stringifyDebugLabel } from '@glimmer/util';

import { Accessor } from './accessor';
import { unwrapReactive, updateReactive } from './core';
import { FallibleFormula } from './formula';
import { REFERENCE } from './internal/reactive';
import { isUpdatableRef } from './predicates';

export const createDebugAliasRef = enhancedDevmode(
  (inner: Reactive) => inner,
  (inner: Reactive, debugLabel: () => string): Reactive => {
    const update = isUpdatableRef(inner) ? (value: unknown) => updateReactive(inner, value) : null;

    const ref = update
      ? Accessor({ get: () => unwrapReactive(inner), set: update }, debugLabel())
      : FallibleFormula(() => unwrapReactive(inner), debugLabel());

    ref[REFERENCE] = inner[REFERENCE];

    const debug = inDevmode(inner.description);

    ref.description = devmode(
      () =>
        ({
          type: 'DebugAlias',
          read: debug.read,
          write: debug.write,
          property: debug.property,
          reason: 'alias',
          label: [`{${inDevmode(stringifyDebugLabel(inner))} as ${debugLabel}}`],
        }) satisfies DefaultDescriptionFields
    );

    return ref;
  }
);
