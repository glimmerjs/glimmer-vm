import type {
  DebugLabel,
  DebugLabelSpec,
  DefaultDescriptionFields,
  Described,
  Description,
  DescriptionSpec,
  DevMode,
  Optional,
  ValidatableDescription,
} from '@glimmer/interfaces';

import { isArray } from '../array-utils';
import { isObject } from '../collections';
import { assert, devmode, inDevmode, mapDevmode } from './assert';

export function stringifyDebugLabel(described: Described<Description>): DevMode<string> {
  return mapDevmode(
    () => described.description,
    (debug) => {
      return stringifyChildLabel(...debug.label);
    }
  );
}

export function stringifyChildLabel(...parts: DebugLabel): string {
  assert(
    parts.every((part) => typeof part === 'string' || typeof part === 'symbol'),
    `Expected all parts to be strings or symbols`
  );

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

export function toLabel(
  spec: Optional<DebugLabelSpec> | false,
  defaultLabel: DebugLabel
): DevMode<DebugLabel> {
  return devmode(() => {
    if (!spec) return defaultLabel;

    if (typeof spec === 'string') {
      return [spec];
    } else {
      return spec;
    }
  });
}

export function toValidatableDescription<D extends ValidatableDescription>(
  spec: Optional<DescriptionSpec>,
  defaults: DevMode<DefaultDescriptionFields<D>>
): DevMode<D> {
  return mapDevmode(
    () => defaults,
    (defaults): D => {
      if (!isObject(spec) || isArray(spec)) {
        return {
          ...defaults,
          label: inDevmode(toLabel(spec, defaults.label)),
        } as D;
      } else {
        return {
          ...defaults,
          ...spec,
          label: typeof spec.label === 'string' ? ([spec.label] as const) : spec.label,
        } as unknown as D;
      }
    }
  );
}
