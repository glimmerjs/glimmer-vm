import type {
  DefaultDescriptionFields,
  ReadonlyReactiveCell,
  RETURN_TYPE,
} from '@glimmer/interfaces';
import { devmode, setDescription } from '@glimmer/util';
import { CONSTANT_TAG } from '@glimmer/validator';

import { InternalReactive, READONLY_CELL } from './internal/reactive';

export type Primitive = string | number | boolean | null | undefined | bigint | symbol;

export const UNDEFINED_REFERENCE = createPrimitiveCell(undefined);
export const NULL_REFERENCE = createPrimitiveCell(null);
export const TRUE_REFERENCE = createPrimitiveCell(true);
export const FALSE_REFERENCE = createPrimitiveCell(false);

export function createPrimitiveCell<T extends Primitive>(value: T): ReadonlyReactiveCell<T> {
  const ref = new InternalReactive(READONLY_CELL);

  ref.tag = CONSTANT_TAG;
  ref.lastValue = value;

  setDescription(
    ref,
    devmode(
      () =>
        ({
          type: 'PrimitiveCell',
          read: 'infallible',
          write: 'none',
          property: {
            read: 'fallible',
            write: 'none',
          },
          label: [value === undefined ? 'undefined' : JSON.stringify(value)],
        }) satisfies DefaultDescriptionFields
    )
  );

  return ref as RETURN_TYPE;
}
