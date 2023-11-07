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

/**
 * A cell can be read from (or written to without any chance of error). Computing a formula (or
 * writing to an accessor) may produce an error. A poisoned value is permanently an error and any
 * attempt to read or write it will produce an error.
 */
type ReferenceKind = 'cell' | 'formula' | 'property' | 'poisoned' | 'alias';

export type DebugLabel = [string, ...(string | symbol)[]];

interface Description {
  /**
   * Deeply readonly references also have deeply readonly property references.
   */
  readonly readonly: boolean | 'deep';
  readonly kind?: ReferenceKind | undefined;

  /**
   * A fallible reactive value can produce an error.
   */
  readonly fallible: boolean;

  /**
   * If serialization is `String`, the value can be converted to a string using `String()`. If the
   * serialization is `JSON`, the value can be converted to a useful string using `JSON.stringify`.
   * Otherwise, the value is a regular object and cannot be easily serialized for debugging purposes.
   */
  readonly serialization?: 'String' | 'JSON' | undefined;

  /**
   * Each part in a label represents a property path.
   */
  readonly label: DebugLabel;
}

export interface RawReactive<T = unknown, K = ReactiveType> {
  [REFERENCE]: K;
  error: UserException | null;
  debug?: Description;
  /**
   * If `compute` produces an error, it should set `error` and return `undefined`.
   */
  compute: Nullable<() => Optional<T>>;
  properties: null | Map<PropertyKey | RawReactive, RawReactive>;
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
