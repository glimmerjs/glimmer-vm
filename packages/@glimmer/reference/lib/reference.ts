import type {
  AccessorType,
  ConstantErrorType,
  ConstantReactiveError,
  DeeplyConstantReactive,
  DeeplyConstantType,
  Described,
  Description,
  DescriptionSpec,
  DevMode,
  DirtyableTag,
  FallibleFormulaType,
  FallibleReactiveFormula,
  InfallibleFormulaType,
  MutableCellType,
  MutableReactiveCell,
  Nullable,
  Optional,
  RawReactive,
  ReactiveAccessor,
  ReactiveCell,
  ReactiveResult,
  ReactiveType,
  ReadonlyCellType,
  ReferenceDescription,
  ReferenceSymbol,
  SomeReactive,
  UpdatableTag,
  UserException as UserExceptionInterface,
} from '@glimmer/interfaces';
import type {Revision, Tag} from '@glimmer/validator';

import {
  assert,
  devmode,
  devmodeOr,
  Err,
  getDescription,
  inDevmode,
  Ok,
  setDescription,
  stringifyChildLabel,
  stringifyDebugLabel,
  toDescription,
  UserException,
} from '@glimmer/util';
import {
  CONSTANT_TAG,
  consumeTag,
  createTag,
  dirtyTag,
  DIRYTABLE_TAG_ID,
  INITIAL,
  TAG_TYPE,
  track,
  UPDATABLE_TAG_ID,
  valueForTag
} from '@glimmer/validator';

import { unwrapReactive, updateReactive } from './api';
import { Accessor } from './api/accessor';
import { FallibleFormula } from './api/formula';
import { validateReactive } from './internal';

export const REFERENCE: ReferenceSymbol = Symbol('REFERENCE') as ReferenceSymbol;

export const MUTABLE_CELL: MutableCellType = 0;
export const READONLY_CELL: ReadonlyCellType = 1;
export const DEEPLY_CONSTANT: DeeplyConstantType = 2;
export const FALLIBLE_FORMULA: FallibleFormulaType = 3;
export const INFALLIBLE_FORMULA: InfallibleFormulaType = 4;
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

export type { SomeReactive as default };
export type { SomeReactive };

//////////

export interface ReferenceEnvironment {
  getProp(obj: unknown, path: string): unknown;
  setProp(obj: unknown, path: string, value: unknown): unknown;
}

export class Reactive<T = unknown, K extends ReactiveType = ReactiveType>
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

export function updateInternalReactive(reactive: Reactive, value: unknown): ReactiveResult<void> {
  if (reactive.update) {
    reactive.update(value);
  } else {
    if (reactive.tag === CONSTANT_TAG) {
      return Err(
        UserException.from(
          Error(`Cannot update a constant value (${describeReactive(reactive as SomeReactive)})`),
          `Cannot update a constant value (${describeReactive(reactive as SomeReactive)})`
        )
      );
    }

    let tag = reactive.tag as DirtyableTag | UpdatableTag | null;

    if (import.meta.env.DEV) {
      assert(
        tag === null || tag[TAG_TYPE] === DIRYTABLE_TAG_ID || tag[TAG_TYPE] === UPDATABLE_TAG_ID,
        `Expected a dirtyable or updatable tag (${describeReactive(reactive as SomeReactive)})`
      );
    }

    reactive.lastValue = value;

    if (tag === null) {
      reactive.tag = createTag(reactive.description);
    } else {
      dirtyTag(tag);
    }
  }

  return Ok(undefined);
}

export function getChildLabel(parent: Described<Description>, child: PropertyKey) {
  if (import.meta.env.DEV) {
    return stringifyChildLabel(...inDevmode(parent.description).label, child as string | symbol);
  } else {
    return String(child);
  }
}

/*
  eslint-disable-next-line @typescript-eslint/no-explicit-any -- inferred from the return type
 */
export type RETURN_TYPE = any;

export function DeeplyConstant<T>(
  value: T,
  debugLabel?: false | string
): DeeplyConstantReactive<T> {
  const ref = new Reactive(DEEPLY_CONSTANT);

  ref.tag = CONSTANT_TAG;
  ref.lastValue = value;

  if (import.meta.env.DEV) {
    ref.description = devmode(() => ({
      readonly: 'deep',
      fallible: false,
      label: [debugLabel || `(DeeplyConstant)`],
      kind: 'cell',
    }));
  }

  return ref as RETURN_TYPE;
}

export function Poison(
  error: UserExceptionInterface,
  debugLabel?: false | string
): ConstantReactiveError {
  const ref = new Reactive(CONSTANT_ERROR);

  ref.tag = CONSTANT_TAG;
  ref.error = error;

  if (import.meta.env.DEV) {
    ref.description = devmode(() => ({
      readonly: true,
      fallible: true,
      label: [debugLabel || `(Poison)`],
      kind: 'poisoned',
    }));
  }

  return ref as RETURN_TYPE;
}

const MARKER_DEFAULTS = devmode(() => ({
  readonly: false,
  fallible: false,
  kind: 'cell',
  label: [`(Marker)`],
}));

interface Marker extends Described<ReferenceDescription> {
  mark: () => void;
  consume: () => void;
}

export function Marker(debugLabel?: DescriptionSpec): Marker {
  const description = toDescription(debugLabel, MARKER_DEFAULTS);
  const tag = createTag(description);

  const marker = {
    mark: () => dirtyTag(tag),
    consume: () => consumeTag(tag),
  };

  setDescription(marker, description);

  return marker;
}

const MUTABLE_CELL_DEFAULTS = devmode(() => ({
  readonly: false,
  fallible: false,
  kind: 'cell',
  label: ['(MutableCell)'],
}));

export function MutableCell<T>(value: T, debugLabel?: DescriptionSpec): MutableReactiveCell<T> {
  const ref = new Reactive(MUTABLE_CELL);

  const tag = (ref.tag = createTag(toDescription(debugLabel, MUTABLE_CELL_DEFAULTS)));
  ref.lastValue = value;

  ref.update = (value) => {
    ref.lastValue = value;
    dirtyTag(tag);
  };

  setDescription(
    ref,
    devmode(() => toDescription(debugLabel, MUTABLE_CELL_DEFAULTS))
  );

  return ref as RETURN_TYPE;
}

const READONLY_CELL_DEFAULTS = devmode(() => ({
  readonly: false,
  fallible: false,
  kind: 'cell',
  label: ['(ReadonlyCell)'],
}));

export function ReadonlyCell<T>(value: T, description?: DescriptionSpec): ReactiveCell<T> {
  const ref = new Reactive(READONLY_CELL);

  ref.tag = CONSTANT_TAG;
  ref.lastValue = value;

  setDescription(
    ref,
    devmode(() => toDescription(description, READONLY_CELL_DEFAULTS))
  );

  return ref as RETURN_TYPE;
}

function getValidResult<T>(ref: Reactive<T>): ReactiveResult<T> {
  return ref.error ? Err(ref.error) : Ok(ref.lastValue as T);
}

export function readInternalReactive<T>(reactive: Reactive<T>): ReactiveResult<T> {
  const { tag, compute } = reactive;

  if (validateReactive(reactive)) {
    consumeTag(reactive.tag);
    return getValidResult(reactive);
  }

  // a data cell
  if (compute === null) {
    if (tag) consumeTag(tag);
    return getValidResult(reactive);
  }

  // a formula
  const newTag = track(compute, getDescription(reactive));

  reactive.tag = newTag;
  reactive.lastRevision = valueForTag(newTag);
  consumeTag(newTag);
  return getValidResult(reactive);
}

export function setError<T>(reactive: Reactive<T>, error: UserExceptionInterface) {
  reactive.lastValue = null;
  reactive.error = error;

  // since the setter threw, we want the reference to be invalid so that its consumers will see the
  // invalidation and handle the error.
  reactive.tag = null;
}

export function setResult<T>(reactive: Reactive<T>, result: ReactiveResult<T>) {
  switch (result.type) {
    case 'ok':
      return setLastValue(reactive, result.value);
    case 'err':
      setError(reactive, result.value);
  }
}

function setLastValue<T>(reactive: Reactive<T>, value: T): T {
  reactive.lastValue = value;
  reactive.error = null;
  return value;
}

export function setFromFallibleCompute<T>(reactive: Reactive<T>, compute: () => T): T | undefined {
  try {
    return setLastValue(reactive, compute());
  } catch (e) {
    setError(
      reactive,
      UserException.from(
        e,
        `An error occured while computing ${devmodeOr(
          () => stringifyDebugLabel(reactive),
          'a formula'
        )}`
      )
    );
  }
}

export function isUpdatableRef(_ref: SomeReactive) {
  const ref = _ref as Reactive;

  return ref.update !== null;
}

export function isFallibleFormula<T>(_ref: SomeReactive<T>): _ref is FallibleReactiveFormula<T> {
  return _ref[REFERENCE] === FALLIBLE_FORMULA;
}

export function isAccessor<T>(_ref: SomeReactive<T>): _ref is ReactiveAccessor<T> {
  return _ref[REFERENCE] === ACCESSOR;
}

export function isConstantError<T>(_ref: SomeReactive<T>): _ref is ConstantReactiveError {
  return _ref[REFERENCE] === CONSTANT_ERROR;
}

export function updateRefWithResult<T>(ref: SomeReactive<T>, value: ReactiveResult<T>) {
  switch (value.type) {
    case 'err':
      setError(ref as Reactive, value.value);
      break;
    case 'ok':
      updateReactive(ref, value.value);
      break;
  }
}

/** @category compat */
export const updateRef = updateReactive;

export function getLastRevision(reactive: SomeReactive): Nullable<Revision> {
  return (reactive as Reactive).lastRevision;
}

function describeReactive(ref: SomeReactive): string | undefined {
  if (import.meta.env.DEV) {
    return inDevmode(stringifyDebugLabel(ref));
  } else {
    return 'reference';
  }
}

export let createDebugAliasRef:
  | undefined
  | ((debugLabel: string, inner: SomeReactive) => SomeReactive);

if (import.meta.env.DEV) {
  createDebugAliasRef = (debugLabel: string, inner: SomeReactive) => {
    const update = isUpdatableRef(inner) ? (value: unknown) => updateReactive(inner, value) : null;

    const ref = update
      ? Accessor({ get: () => unwrapReactive(inner), set: update }, debugLabel)
      : FallibleFormula(() => unwrapReactive(inner), debugLabel);

    ref[REFERENCE] = inner[REFERENCE];

    const debug = inDevmode(inner.description);

    ref.description = devmode(() => ({
      readonly: debug.readonly,
      fallible: debug.fallible,
      kind: 'alias',
      label: [`(${inDevmode(stringifyDebugLabel(inner))} as ${debugLabel})`],
    }));

    return ref;
  };
}
