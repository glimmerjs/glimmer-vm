import type {
  DebugLabel,
  DefaultDescriptionFields,
  Described,
  Description,
  DescriptionSpec,
  DevMode,
  Optional,
  ReferenceDescription,
} from '@glimmer/interfaces';

import { isArray } from '../array-utils';
import { mapDevmode } from './assert';

export function stringifyDebugLabel(described: Described<Description>): DevMode<string> {
  return mapDevmode(
    () => described.description,
    (debug) => {
      return stringifyChildLabel(...debug.label);
    }
  );
}

export function stringifyChildLabel(...parts: DebugLabel): string {
  const [first, ...rest] = parts;

  let out: string = first;

  for (const part of rest) {
    if (typeof part === 'string') {
      if (/^\p{XID_Start}\p{XID_Continue}*$/u.test(part)) {
        out += `.${part}`;
      } else {
        out += `[${JSON.stringify(part)}]`;
      }
    } else {
      out += `[${String(part)}]`;
    }
  }

  return out;
}

/**
 * Using this function ensures that the `object.description` expression always gets stripped.
 */
export function getDescription<D extends Description>(object: Described<D>): DevMode<D> {
  return mapDevmode(
    () => object.description,
    (desc) => desc
  );
}

export function createWithDescription<O extends Described<D>, D extends Description>(
  create: () => O,
  description: DevMode<D>
): O {
  const object = create();
  setDescription(object, description);
  return object;
}

/**
 * Using this function ensures that the `object.description = value` statement always gets stripped.
 */

export function setDescription<Desc extends Description>(
  object: Described<Desc>,
  description: DevMode<Desc>
): void;
export function setDescription<Desc extends Description, D>(
  object: D,
  description: DevMode<Desc>
): asserts object is D & { description: DevMode<Desc> };
export function setDescription(
  object: { description?: DevMode<Description> },
  description: DevMode<Description>
): void {
  if (import.meta.env.DEV) {
    object.description = description;
  }
}

export function toDescription(
  spec: Optional<DescriptionSpec>,
  defaults: DevMode<DefaultDescriptionFields>
): DevMode<ReferenceDescription> {
  return mapDevmode(
    () => defaults,
    (defaults): ReferenceDescription => {
      if (!spec) return defaults;

      if (typeof spec === 'string') {
        return {
          ...defaults,
          label: [spec],
        };
      } else if (isArray(spec)) {
        return {
          ...defaults,
          label: spec,
        };
      } else {
        const normalizedSpec: Pick<ReferenceDescription, 'label' | 'serialization' | 'internal'> = {
          ...spec,
          label: typeof spec.label === 'string' ? ([spec.label] as const) : spec.label,
        };

        return {
          ...defaults,
          ...normalizedSpec,
        };
      }
    }
  );
}
