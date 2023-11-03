import type { Result } from '@glimmer/interfaces';

import type { Nullable, Optional } from './core';

/**
 * A mutable cell represents a mutable, infallible piece of storage. Children of a data cell are not
 * necessarily data cells. A mutable data cell can be directly mutated, and the mutation is also
 * infallible.
 */
export type MutableCellType = 0;
/**
 * A readonly cell represents an infallible piece of storage. Children of a data cell are not
 * necessarily data cells. A readonly data cell cannot be directly mutated.
 */
export type ReadonlyCellType = 1;
/**
 * A deeply constant cell is a cell whose value cannot change. Children of a data cell are also
 * deeply constant (recursively).
 */
export type DeeplyConstantType = 2;
/**
 * A fallible formula represents a user-space computation that could fail.
 */
export type FallibleFormulaType = 3;
/**
 * An infallible formula represents a computation created by the VM. It is not allowed to fail. If
 * an infallible formula throws an exception, there is no error recovery.
 */
export type InfallibleFormulaType = 4;
/**
 * An accessor has both a user-space computation and a userspace update. Both are fallible.
 */
export type AccessorType = 5;
export type ConstantErrorType = 6;

export interface ReactiveTypes {
  readonly MutableCell: MutableCellType;
  readonly ReadonlyCell: ReadonlyCellType;
  readonly DeeplyConstant: DeeplyConstantType;
  readonly InfallibleFormula: InfallibleReactiveFormula;
  readonly FallibleFormula: FallibleFormulaType;
  readonly Accessor: AccessorType;
  readonly ConstantError: ConstantErrorType;
}

export type ReactiveType =
  | MutableCellType
  | ReadonlyCellType
  | DeeplyConstantType
  | InfallibleFormulaType
  | FallibleFormulaType
  | AccessorType
  | ConstantErrorType;

declare const REFERENCE: unique symbol;
export type ReferenceSymbol = typeof REFERENCE;

export interface UserException extends Error {
  readonly error: Error | undefined;
  readonly exception: unknown;
}

export interface RawReactive<T = unknown, K = ReactiveType> {
  [REFERENCE]: K;
  error: UserException | null;
  debugLabel?: string | undefined;
  debug?: { isPrimitive: boolean } | undefined;
  /**
   * If `compute` produces an error, it should set `error` and return `undefined`.
   */
  compute: Nullable<() => Optional<T>>;
  children: null | Map<PropertyKey | RawReactive, RawReactive>;
}

export type SomeReactive<T = unknown> =
  | ReactiveCell<T>
  | InfallibleReactiveFormula<T>
  | FallibleReactiveFormula<T>
  | ReactiveAccessor<T>
  | ConstantReactiveError;

export type DeeplyConstantReactive<T = unknown> = RawReactive<T, DeeplyConstantType>;
export type ConstantReactiveError = RawReactive<void, ConstantErrorType> & {
  error: UserException;
};

export type ReadonlyReactiveCell<T = unknown> =
  | DeeplyConstantReactive<T>
  | RawReactive<T, ReadonlyCellType>;
export type MutableReactiveCell<T = unknown> =
  | DeeplyConstantReactive<T>
  | RawReactive<T, MutableCellType>;

export type ReactiveCell<T = unknown> =
  | DeeplyConstantReactive<T>
  | ReadonlyReactiveCell<T>
  | MutableReactiveCell<T>;

export type InfallibleReactiveFormula<T = unknown> = RawReactive<T, InfallibleFormulaType>;
export type FallibleReactiveFormula<T = unknown> = RawReactive<T, FallibleFormulaType>;
export type ReactiveAccessor<T = unknown> = RawReactive<T, AccessorType>;

export type ReactiveResult<T> = Result<T, UserException>;
