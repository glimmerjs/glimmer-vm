import type { NullableName } from '../../debug';
import type { FallibleVmCheck, InfallibleVmCheck, VmCheck } from '../types';
import type { RuntimeValueSpecName } from './runtime-value';
import type { NamedSpecValue } from './shared';

export type VmRuntimeValueCheck<N extends RuntimeValueSpecName> = VmCheck<unknown, N>;

export function infallible<const N extends RuntimeValueSpecName>(
  name: N,
  unpack: InfallibleVmCheck<unknown, N>['unpack']
): VmRuntimeValueCheck<N> {
  return { name, unpack };
}

export function define<const N extends RuntimeValueSpecName>(
  name: N,
  expected: string,
  unpack: FallibleVmCheck<unknown, N>['unpack']
) {
  return {
    name,
    expected,
    unpack,
  };
}

define.infallible = infallible;

export function nullable<N extends NullableName<RuntimeValueSpecName>>(
  spec: VmRuntimeValueCheck<N>
): VmRuntimeValueCheck<`${N}?`> {
  if ('expected' in spec) {
    return {
      name: `${spec.name}?`,
      expected: `a nullable ${spec.expected}`,
      unpack: (value, debug) => {
        if (value === null) {
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
        if (value === null) {
          return null as unknown as NamedSpecValue<`${N}?`>;
        } else {
          return spec.unpack(value, debug) as unknown as NamedSpecValue<`${N}?`>;
        }
      },
    };
  }
}
