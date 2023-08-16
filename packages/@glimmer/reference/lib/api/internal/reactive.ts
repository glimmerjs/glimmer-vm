import type {
  AccessorType,
  ComputedCellType,
  ConstantErrorType,
  DeeplyConstantType,
  Described,
  DevMode,
  FormulaType,
  MutableCellType,
  Nullable,
  Optional,
  RawReactive,
  Reactive,
  ReactiveType,
  ReadonlyCellType,
  ReferenceDescription,
  ReferenceSymbol,
  Tag,
  UserException as UserExceptionInterface,
} from '@glimmer/interfaces';
import type { Revision } from '@glimmer/validator';
import { INITIAL } from '@glimmer/validator';

export const REFERENCE: ReferenceSymbol = Symbol('REFERENCE') as ReferenceSymbol;

export const MUTABLE_CELL: MutableCellType = 0;
export const READONLY_CELL: ReadonlyCellType = 1;
export const DEEPLY_CONSTANT: DeeplyConstantType = 2;
export const FALLIBLE_FORMULA: FormulaType = 3;
export const COMPUTED_CELL: ComputedCellType = 4;
export const ACCESSOR: AccessorType = 5;
export const CONSTANT_ERROR: ConstantErrorType = 6;

export const REACTIVE_DESCRIPTIONS = [
  'mutable',
  'readonly',
  'deeply constant',
  'fallible formula',
  'infallible formula',
  'accessor',
  'constant error',
];

export type { Reactive };

//////////

export interface ReferenceEnvironment {
  getProp(obj: unknown, path: string): unknown;
  setProp(obj: unknown, path: string, value: unknown): unknown;
}

export class InternalReactive<T = unknown, K extends ReactiveType = ReactiveType>
  implements RawReactive<T, K>, Described<ReferenceDescription>
{
  readonly [REFERENCE]: K;

  public tag: Nullable<Tag> = null;

  /**
   * The revision of the reactive the last time it was updated (if it was a cell) or computed (if it
   * was a formula).
   */
  public lastRevision: Revision = INITIAL;

  /**
   * A reactive is in an error state if its `compute` function produced an error.
   */
  public error: Nullable<UserExceptionInterface> = null;

  /**
   * In a data cell, lastValue is the value of the cell, and `lastValue` or `error` is always set.
   * In a formula cell, lastValue is the cached result of the formula. If lastValue is null and
   * error is null, the formula is uninitialized.
   */
  public lastValue?: Nullable<T>;

  /**
   * In a data cell, compute is always null.
   */
  public compute: Nullable<() => Optional<T>> = null;

  /**
   * In an accessor, `update` is the mutator function. Otherwise, `update` is always null.
   */
  public update: Nullable<(val: T) => void> = null;

  /**
   * In any kind of reference, `properties` is a map from property keys to their references.
   */
  public properties: Nullable<Map<PropertyKey | RawReactive, RawReactive>> = null;

  declare description: DevMode<ReferenceDescription>;

  constructor(type: K) {
    this[REFERENCE] = type;
  }
}
