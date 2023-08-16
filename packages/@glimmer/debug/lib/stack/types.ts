import type { DebugState } from '../render/state';
import type { OperandSpecValue } from './declared/operands';
import type { MISMATCH, NamedSpecValue, SpecName, TypedSpecName } from './declared/shared';

export type StackParamSpec<T = unknown> =
  | readonly [op: `peek:${string}`, name: TypedSpecName<T>, options?: { from: '$fp' }]
  | readonly [op: `pop:${string}`, name: TypedSpecName<T>];

export interface StackSpec {
  readonly params: readonly StackParamSpec[];
  readonly pushes: readonly SpecName[] | ['frame:change'];
}

export type Operand<T extends OperandSpecValue> = [op: string, name: TypedSpecName<T>];

type MachineRegisterName = '$ra' | '$sp' | '$fp' | '$pc';
type ValueRegisterName = '$s0' | '$s1' | '$t0' | '$t1' | '$v0';
type UnwindRegisterName = '$up';
type VmStateName =
  | 'owner'
  | ['lexical-scope/value', TypedSpecName<number>]
  | ['lexical-scope/block', TypedSpecName<number>]
  // changes the entire lexical scope
  | 'scope'
  | 'dynamic-scope/value'
  | 'destroyable';

export type StateSpec =
  | MachineRegisterName
  | UnwindRegisterName
  | VmStateName
  | [ValueRegisterName, SpecName];

export type OpcodeSpec<A = unknown, B = unknown, C = unknown> =
  | readonly []
  | readonly [Operand<A>]
  | readonly [Operand<A>, Operand<B>]
  | readonly [Operand<A>, Operand<B>, Operand<C>];

export interface OpSpec {
  readonly name: string;
  readonly ops: OpcodeSpec;
  readonly stack: StackSpec;
  readonly reads: readonly StateSpec[];
  readonly changes: readonly StateSpec[];
  readonly throws: boolean;
}
export interface DebugNarrow<Wide, In extends Wide> {
  readonly expected: string;
  coerce: (value: Wide, debug: DebugState) => In | MISMATCH;
}

export type FallibleCheckResult<T> =
  | { ok: T }
  | { error: 'mismatch' }
  | { error: 'deref'; threw: unknown };

export type FallibleVmCheck<In, N extends SpecName> = {
  readonly name: N;
  readonly expected: string;
  readonly unpack: (value: In, debug: DebugState) => FallibleCheckResult<NamedSpecValue<N>>;
};

export type InfallibleVmCheck<In, N extends SpecName> = {
  readonly name: N;
  readonly unpack: (value: In, debug: DebugState) => NamedSpecValue<N>;
};

export type VmCheck<In, N extends SpecName> = FallibleVmCheck<In, N> | InfallibleVmCheck<In, N>;
