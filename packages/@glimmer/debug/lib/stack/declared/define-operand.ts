import type { NullableName } from '../../debug';
import type { FallibleVmCheck, InfallibleVmCheck, VmCheck } from '../types';
import type { OperandSpecName } from './operands';
import type { NamedSpecValue } from './shared';

import { NULL_HANDLE } from '@glimmer/util';

export type VmOperandCheck<N extends OperandSpecName = OperandSpecName> = VmCheck<number, N>;

export function define<const N extends OperandSpecName>(
  name: N,
  unpack: InfallibleVmCheck<number, N>['unpack']
): VmOperandCheck<N> {
  return { name, unpack };
}

define.fallible = <const N extends OperandSpecName>(
  name: N,
  expected: string,
  unpack: FallibleVmCheck<number, N>['unpack']
) => {
  return {
    name,
    expected,
    unpack,
  };
};

export function nullable<N extends NullableName<OperandSpecName>>(
  spec: VmOperandCheck<N>
): VmOperandCheck<`${N}?`> {
  if ('expected' in spec) {
    return {
      name: `${spec.name}?`,
      expected: `a nullable ${spec.expected}`,
      unpack: (value, debug) => {
        if (value === NULL_HANDLE) {
          return null as any;
        } else {
          return spec.unpack(value, debug);
        }
      },
    };
  } else {
    return {
      name: `${spec.name}?`,
      unpack: (value, debug) => {
        if (value === NULL_HANDLE) {
          return null as unknown as NamedSpecValue<`${N}?`>;
        } else {
          return spec.unpack(value, debug) as unknown as NamedSpecValue<`${N}?`>;
        }
      },
    };
  }
}
