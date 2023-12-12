import type { DevMode, Result } from '..';
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
 * A formula represents a user-space computation that could fail.
 */
export type FormulaType = 3;
/**
 * An computed cell represents a computation created by the VM. It is not allowed to fail. If
 * a computed cell throws an exception, there is no error recovery.
 */
export type ComputedCellType = 4;
/**
 * An accessor has both a user-space computation and a userspace update. Both are fallible.
 */
export type AccessorType = 5;
export type ConstantErrorType = 6;

export interface ReactiveTypes {
  readonly MutableCell: MutableCellType;
  readonly ReadonlyCell: ReadonlyCellType;
  readonly DeeplyConstant: DeeplyConstantType;
  readonly ComputedCell: ReactiveComputedCell;
  readonly Formula: FormulaType;
  readonly Accessor: AccessorType;
  readonly ConstantError: ConstantErrorType;
}

export type ReactiveType =
  | MutableCellType
  | ReadonlyCellType
  | DeeplyConstantType
  | ComputedCellType
  | FormulaType
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
type ReferenceReason = string;

export type DebugLabel = readonly [string, ...(string | symbol)[]];

export type DebugLabelSpec = DebugLabel | string;

export type DescriptionSpec =
  | DebugLabelSpec
  | false
  | undefined
  | {
      readonly label: DebugLabelSpec;

      readonly serialization?: 'String' | 'JSON' | undefined;

      /**
       * If the reactive value represents an internal implementation detail, you should populate this
       * field.
       */
      readonly internal?: {
        parent: ReferenceDescription;
        reason: string;
      };
    };

/**
 * These fields are provided by the reference constructors, and provide defaults for specific
 * reference types.
 */
export type DefaultDescriptionFields<D extends Description = ReferenceDescription> = {
  [P in keyof D as Extract<P, 'reason' | 'type' | 'read' | 'write' | 'property' | 'label'>]: D[P];
};
interface Described<D extends Description = Description> {
  description: DevMode<D>;
}

interface Description {
  readonly reason?: string | undefined;

  /**
   * Each part in a label represents a property path.
   */
  readonly label: DebugLabel;
}

interface ValidatableDescription extends Description {
  readonly reason?: string | undefined;

  /**
   * If serialization is `String`, the value can be converted to a string using `String()`. If the
   * serialization is `JSON`, the value can be converted to a useful string using `JSON.stringify`.
   * Otherwise, the value is a regular object and cannot be easily serialized for debugging purposes.
   */
  readonly serialization?: 'String' | 'JSON' | undefined;

  internal?: {
    readonly parent?: ValidatableDescription;
    readonly internal?: string;
  };
}

/**
 * Fallible storage might produce an error when accessed.
 */
type FALLIBLE_STORAGE = 'fallible';

/**
 * Infallible storage does not produce an error when accessed. It is usually a cell, but can also be
 * special `InfallibleFormula` references that are asserted to be infallible. If accessing an
 * infallible storage throws, there is no error recovery.
 */
type INFALLIBLE_STORAGE = 'infallible';

/**
 * When storage is not accessible for an operation, that operation is not available.
 */
type NOT_ACCESSIBLE = 'none';

interface ReferenceDescription extends ValidatableDescription {
  /**
   * The name of the primitive reactive constructor that was used to create this
   * reactive value (e.g. "ReadonlyCell").
   */
  readonly type: string;

  read: FALLIBLE_STORAGE | INFALLIBLE_STORAGE;
  write: FALLIBLE_STORAGE | INFALLIBLE_STORAGE | NOT_ACCESSIBLE;

  /**
   * The default value of `property` is:
   *
   * { read: 'fallible', write: 'fallible' }
   */
  property?:
    | {
        read: FALLIBLE_STORAGE | INFALLIBLE_STORAGE;
        write: FALLIBLE_STORAGE | INFALLIBLE_STORAGE | NOT_ACCESSIBLE;
      }
    | undefined;
}

interface TagDescription extends ValidatableDescription {
  subtags?: readonly TagDescription[];
}

export interface RawReactive<T = unknown, K = ReactiveType>
  extends Described<ReferenceDescription> {
  [REFERENCE]: K;
  error: UserException | null;
  /**
   * If `compute` produces an error, it should set `error` and return `undefined`.
   */
  compute: Nullable<() => Optional<T>>;
  properties: null | Map<PropertyKey | RawReactive, RawReactive>;
}

export type Reactive<T = unknown> =
  | ReactiveCell<T>
  | ReactiveComputedCell<T>
  | ReactiveFormula<T>
  | ReactiveAccessor<T>
  | ConstantReactiveError;

export type DeeplyConstantReactiveCell<T = unknown> = RawReactive<T, DeeplyConstantType>;
export type ConstantReactiveError = RawReactive<void, ConstantErrorType> & {
  error: UserException;
};

export type ReadonlyReactiveCell<T = unknown> =
  | DeeplyConstantReactiveCell<T>
  | RawReactive<T, ReadonlyCellType>;
export type MutableReactiveCell<T = unknown> =
  | DeeplyConstantReactiveCell<T>
  | RawReactive<T, MutableCellType>;

export type ReactiveCell<T = unknown> =
  | ReadonlyReactiveCell<T>
  | MutableReactiveCell<T>
  | ReactiveComputedCell<T>;

export type ReactiveComputedCell<T = unknown> = RawReactive<T, ComputedCellType>;
export type ReactiveFormula<T = unknown> = RawReactive<T, FormulaType>;
export type ReactiveAccessor<T = unknown> = RawReactive<T, AccessorType>;

export type ReactiveResult<T> = Result<T, UserException>;
