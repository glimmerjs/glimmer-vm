import { getProperty, setProperty } from '@glimmer/global-context';
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
  InfallibleReactiveFormula,
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
  ReadonlyReactiveCell,
  ReferenceDescription,
  ReferenceSymbol,
  SomeReactive,
  UpdatableTag,
  UserException as UserExceptionInterface,
} from '@glimmer/interfaces';
import {
  assert,
  devmode,
  devmodeOr,
  Err,
  expect,
  getDescription,
  inDevmode,
  isDict,
  isObject,
  mapDevmode,
  Ok,
  setDescription,
  stringifyChildLabel,
  stringifyDebugLabel,
  toDescription,
  unwrap,
  unwrapResult,
  UserException,
} from '@glimmer/util';
import {
  CONSTANT_TAG,
  consumeTag,
  createTag,
  dirtyTag,
  dirtyTagFor,
  DIRYTABLE_TAG_ID,
  INITIAL,
  INVALID_REVISION,
  type Revision,
  type Tag,
  TAG_TYPE,
  tagFor,
  track,
  UPDATABLE_TAG_ID,
  validateTag,
  valueForTag,
} from '@glimmer/validator';

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

class Reactive<T = unknown, K extends ReactiveType = ReactiveType>
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
   * A reactive is poisoned if its `update` function threw an error.
   */
  public poison: Nullable<UserExceptionInterface> = null;

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

function updateInternalReactive(reactive: Reactive, value: unknown): ReactiveResult<void> {
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

function getChildLabel(parent: Described<Description>, child: PropertyKey) {
  if (import.meta.env.DEV) {
    return stringifyChildLabel(...inDevmode(parent.description).label, child as string | symbol);
  } else {
    return String(child);
  }
}

/*
  eslint-disable-next-line @typescript-eslint/no-explicit-any -- inferred from the return type
 */
type RETURN_TYPE = any;

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

export function Marker(debugLabel?: DescriptionSpec): { mark: () => void; consume: () => void } {
  const tag = createTag(toDescription(debugLabel, MARKER_DEFAULTS));

  return {
    mark: () => dirtyTag(tag),
    consume: () => consumeTag(tag),
  };
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

export function RecoverableFormula<T = unknown>(compute: () => T, debugLabel?: false | string) {
  const tryRecover = import.meta.env.DEV
    ? Marker(`${debugLabel ?? `RecoverableFormula`}`)
    : Marker();
}

const FALLIBLE_FORMULA_DEFAULTS = devmode(() => ({
  readonly: false,
  fallible: false,
  kind: 'cell',
  label: ['(FallibleFormula)'],
}));

/**
 * A fallible formula invokes user code. If the user code throws an exception, the formula returns
 * an error {@linkcode Result}. Otherwise, it returns an ok {@linkcode Result}.
 */
export function FallibleFormula<T = unknown>(
  compute: () => T,
  debugLabel?: DescriptionSpec
): FallibleReactiveFormula<T> {
  const ref = new Reactive<T>(FALLIBLE_FORMULA);

  ref.compute = () => setFromFallibleCompute(ref, compute);

  setDescription(
    ref,
    devmode(() => toDescription(debugLabel, FALLIBLE_FORMULA_DEFAULTS))
  );

  return ref as RETURN_TYPE;
}

const RESULT_FORMULA_DEFAULTS = devmode(() => ({
  readonly: true,
  fallible: true,
  kind: 'formula',
  label: [`(ResultFormula)`],
}));

/**
 * The `compute` function must be infallible and convert any errors to results.
 */
export function ResultFormula<T = unknown>(
  compute: () => ReactiveResult<T>,
  description?: DescriptionSpec
) {
  const ref = new Reactive<T>(FALLIBLE_FORMULA);

  ref.compute = () => setResult(ref, compute());

  setDescription(
    ref,
    devmode(() => toDescription(description, RESULT_FORMULA_DEFAULTS))
  );

  return ref as RETURN_TYPE;
}

const RESULT_ACCESSOR_DEFAULTS = devmode(() => ({
  readonly: false,
  fallible: true,
  kind: 'formula',
  label: [`(ResultAccessor)`],
}));

export function ResultAccessor<T = unknown>(
  options: {
    get: () => ReactiveResult<T>;
    set: (val: T) => ReactiveResult<void>;
  },
  description?: DescriptionSpec
): SomeReactive<T> {
  const { get, set } = options;

  const ref = new Reactive<T>(ACCESSOR);

  ref.compute = () => setResult(ref, get());

  ref.update = (value: T) => {
    const setResult = set(value);

    if (setResult.type === 'ok') {
      ref.lastValue = value;
    } else {
      setError(ref, setResult.value);
    }
  };

  setDescription(
    ref,
    devmode(() => toDescription(description, RESULT_ACCESSOR_DEFAULTS))
  );
  return ref as RETURN_TYPE;
}

const ACCESSOR_DEFAULTS = devmode(() => ({
  readonly: false,
  fallible: true,
  kind: 'formula',
  label: [`(Accessor)`],
}));

export function Accessor<T = unknown>(
  options: { get: () => T; set: (val: T) => void },
  description?: DescriptionSpec
): SomeReactive<T> {
  const { get, set } = options;

  const ref = new Reactive<T>(ACCESSOR);

  ref.compute = () => setFromFallibleCompute(ref, get);

  ref.update = (value: T) => {
    try {
      set(value);
      return value;
    } catch (e) {
      setPoison(
        ref,
        UserException.from(
          e,
          `An error occured setting ${devmodeOr(() => stringifyDebugLabel(ref), `an accessor`)}`
        )
      );
    }
  };

  setDescription(
    ref,
    devmode(() => toDescription(description, ACCESSOR_DEFAULTS))
  );

  return ref as RETURN_TYPE;
}

function getValidResult<T>(ref: Reactive<T>): ReactiveResult<T> {
  return ref.error ? Err(ref.error) : Ok(ref.lastValue as T);
}

export function readReactive<T>(reactive: SomeReactive<T>): ReactiveResult<T> {
  return readInternalReactive(reactive as Reactive<T>, false);
}

function readInternalReactive<T>(reactive: Reactive<T>, forceError: boolean): ReactiveResult<T> {
  const { tag, compute } = reactive;

  if (reactive.poison) {
    (reactive as Reactive).lastRevision = valueForTag(unwrap(tag));
    return Err(reactive.poison);
  }

  if (validateInternalReactive(reactive, forceError)) {
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

function setError<T>(reactive: Reactive<T>, error: UserExceptionInterface) {
  reactive.lastValue = null;
  reactive.error = error;
}

function setPoison<T>(reactive: Reactive<T>, error: UserExceptionInterface) {
  reactive.lastValue = null;
  reactive.error = null;
  reactive.poison = error;

  reactive.tag = CONSTANT_TAG;
  // Even though the tag is constant, we want the reference to be invalidated so that any consumers
  // of the reference see the error.
  reactive.lastRevision = INVALID_REVISION;
}

/**
 * @internal
 */

export function validateReactive(reactive: SomeReactive): boolean {
  return validateInternalReactive(reactive as Reactive, false);
}

function validateInternalReactive<T>(
  reactive: Reactive<T>,
  forceError: false
): reactive is Reactive<T> & { tag: Tag; error: null };
function validateInternalReactive<T>(
  reactive: Reactive<T>,
  forceError: boolean
): reactive is Reactive<T> & { tag: Tag };
function validateInternalReactive<T>(
  reactive: Reactive<T>,
  forceError: boolean
): reactive is Reactive<T> & { tag: Tag } {
  const { tag, lastRevision } = reactive;

  // not yet computed
  if (tag === null) return false;

  if (reactive.error && forceError) {
    return false;
  }

  return validateTag(tag, lastRevision);
}

function setResult<T>(reactive: Reactive<T>, result: ReactiveResult<T>) {
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

function setFromFallibleCompute<T>(reactive: Reactive<T>, compute: () => T): T | undefined {
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

const INFALLIBLE_FORMULA_DEFAULTS = devmode(() => ({
  readonly: true,
  fallible: false,
  kind: 'formula',
  label: [`(InfallibleFormula)`],
}));

/**
 * An infallible formula does not invoke user code. If an infallible formula's compute function
 * throws an error, it's a bug and there is no error recovery.
 */
export function InfallibleFormula<T = unknown>(
  compute: () => T,
  description?: DescriptionSpec
): InfallibleReactiveFormula<T> {
  const ref = new Reactive<T>(INFALLIBLE_FORMULA);

  ref.compute = compute;

  setDescription(
    ref,
    devmode(() => toDescription(description, INFALLIBLE_FORMULA_DEFAULTS))
  );

  return ref as RETURN_TYPE;
}

type Primitive = string | number | boolean | null | undefined | bigint | symbol;

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

function initializeChildren(parent: SomeReactive) {
  let children = parent.properties;

  if (children === null) {
    children = parent.properties = new Map();
  }

  return children;
}

export function toReadonly<T>(reactive: SomeReactive<T>): FallibleReactiveFormula<T> {
  return FallibleFormula(() => unwrapReactive(reactive));
}

export function toMut<T>(maybeMut: SomeReactive<T>): SomeReactive<T> {
  const reactive = maybeMut as Reactive;

  return ResultAccessor({
    get: () => readInternalReactive(maybeMut as Reactive<T>, false),
    set: (value: unknown) => updateInternalReactive(reactive, value),
  });
}

export function getReactivePath(reactive: SomeReactive, path: string[]): SomeReactive {
  let current: SomeReactive = reactive;

  for (const part of path) {
    current = getReactiveProperty(current, part);
  }

  return current;
}

const PROPERTY_DEFAULTS = devmode(() => ({
  readonly: false,
  fallible: true,
  kind: 'property',
  label: [`(property)`],
}));

export function getReactiveProperty(
  parentReactive: SomeReactive,
  property: PropertyKey
): SomeReactive {
  const type = parentReactive[REFERENCE];

  const children = initializeChildren(parentReactive);

  {
    const child = children.get(property);

    if (child !== undefined) {
      return child as RETURN_TYPE;
    }
  }

  const initialize = (child: SomeReactive): SomeReactive => {
    children.set(property, child);
    return child as RETURN_TYPE;
  };

  if (type === DEEPLY_CONSTANT) {
    // We need an extra try/catch here because any reactive value can be turned into a deeply
    // constant value.
    try {
      const parent = readInternalReactive(parentReactive as Reactive, false);

      if (parent.type === 'err') {
        return initialize(Poison(parent.value));
      } else {
        if (isDict(parent.value)) {
          return initialize(DeeplyConstant(parent.value[property as keyof typeof parent.value]));
        }
      }
    } catch (e) {
      return initialize(
        Poison(
          UserException.from(
            e,
            `An error occured when getting a property from a deeply constant reactive (${getChildLabel(
              parentReactive,
              property
            )})`
          )
        )
      );
    }
  }

  const child = Accessor({
    get: () => {
      const parent = unwrapReactive(parentReactive);
      if (isDict(parent)) {
        if (isObject(parent)) consumeTag(tagFor(parent, property as keyof typeof parent));

        return getProperty(parent, property as keyof typeof parent);
      }
    },
    set: (value: unknown): ReactiveResult<void> => {
      const parentResult = readInternalReactive(parentReactive as Reactive, false);

      if (parentResult.type === 'err') {
        return parentResult;
      } else {
        if (isDict(parentResult.value)) {
          try {
            setProperty(parentResult.value, property as any, value);

            if (isObject(parentResult.value))
              dirtyTagFor(parentResult.value, property as keyof typeof parentResult.value);
          } catch (e) {
            return Err(
              UserException.from(
                e,
                `An error occured when setting a property on a deeply constant reactive (${getChildLabel(
                  parentReactive,
                  property
                )})`
              )
            );
          }
        }

        return Ok(undefined);
      }
    },
  });

  setDescription(
    child,
    mapDevmode(
      () => parentReactive.description,
      (desc) => {
        return toDescription([...desc.label, property as string | symbol], PROPERTY_DEFAULTS);
      }
    )
  );

  return initialize(child);
}

export const UNDEFINED_REFERENCE = createPrimitiveCell(undefined);
export const NULL_REFERENCE = createPrimitiveCell(null);
export const TRUE_REFERENCE = createPrimitiveCell(true);
export const FALSE_REFERENCE = createPrimitiveCell(false);

export function isConstant(reactive: SomeReactive) {
  switch (reactive[REFERENCE]) {
    case READONLY_CELL:
    case DEEPLY_CONSTANT:
      return true;
    default:
      return (reactive as Reactive).tag === CONSTANT_TAG && !(reactive as Reactive).poison;
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

export function readCell<T>(reactive: ReactiveCell<T>): T {
  return unwrapReactive(reactive);
}

export function writeCell<T>(reactive: MutableReactiveCell<T>, value: T): void {
  updateReactive(reactive, value);
}

export function hasError(reactive: SomeReactive): boolean {
  return !!((reactive as Reactive).error || (reactive as Reactive).poison);
}

/**
 * This is generally not what you want, as it rethrows errors. It's useful in testing and console
 * situations, and as a transitional mechanism away from valueForRef.
 */
export function unwrapReactive<T>(reactive: SomeReactive<T>): T {
  return unwrapResult(readInternalReactive(reactive as Reactive<T>, false));
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

export function updateReactive(_ref: SomeReactive, value: unknown) {
  const ref = _ref as Reactive;

  const update = expect(ref.update, 'called update on a non-updatable reference');

  update(value);
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
