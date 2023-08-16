import type { OperandSpec, OperandSpecName } from './operands';
import type { RuntimeValueSpec, RuntimeValueSpecName } from './runtime-value';

/** @deprecated import directly from `@glimmer/util` */
export type { AnyFunction } from '@glimmer/util';

export interface ErrorSpec {
  readonly expected: string;
  readonly got: number;
}

export const MISMATCH = { error: 'mismatch' } as const;
export type MISMATCH = typeof MISMATCH;

export function ok<const T>(value: T): { ok: T } {
  return { ok: value };
}

export type Spec = OperandSpec | RuntimeValueSpec;
export type SpecName = OperandSpecName | RuntimeValueSpecName;
export type NamedSpecValue<N extends SpecName> = NamedSpec<N>[1];
export type NamedSpec<N extends SpecName> = Extract<Spec, { 0: N }>;

export type TypedSpec<T = Spec[1]> = Spec & [string, T];
export type TypedSpecName<T> = TypedSpec<T>[0];
