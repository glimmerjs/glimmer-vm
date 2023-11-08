import type { ReadonlyReactiveCell } from '@glimmer/interfaces';
import type { Primitive } from '../api';
import type { RETURN_TYPE } from '../reference';

import { devmode } from '@glimmer/util';

import { ReadonlyCell } from '../reference';

export function createPrimitiveCell<T extends Primitive>(value: T): ReadonlyReactiveCell<T> {
  const ref = ReadonlyCell(value);

  if (import.meta.env.DEV) {
    ref.description = devmode(() => ({
      readonly: 'deep',
      fallible: false,
      label: [`${JSON.stringify(value)}`],
      kind: 'cell',
      serialization: 'String',
    }));
  }

  return ref as RETURN_TYPE;
}
