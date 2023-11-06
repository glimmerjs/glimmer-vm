import { getProperty, setProperty } from '@glimmer/global-context';
import type {
  AccessorType,
  ConstantErrorType,
  ConstantReactiveError,
  DeeplyConstantReactive,
  DeeplyConstantType,
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
  ReferenceSymbol,
  SomeReactive,
  UpdatableTag,
  UserException as UserExceptionInterface,
} from '@glimmer/interfaces';
import {
  assert,
  Err,
  expect,
  isDict,
  isObject,
  Ok,
  unwrapResult,
  UserException,
} from '@glimmer/util';
import {
  CONSTANT_TAG,
  consumeTag,
  createTag,
  createUpdatableTag,
  dirtyTag,
  dirtyTagFor,
  DIRYTABLE_TAG_ID,
  INITIAL,
  type Revision,
  type Tag,
  TAG_TYPE,
  tagFor,
  track,
  UPDATABLE_TAG_ID,
  validateTag,
  valueForTag,
} from '@glimmer/validator';
import { $REVISION } from '@glimmer/validator/lib/validators';

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

class Reactive<T = unknown, K extends ReactiveType = ReactiveType> implements RawReactive<T, K> {
  readonly [REFERENCE]: K;

  public tag: Nullable<Tag> = null;
  public lastRevision: Revision = INITIAL;

  public error: Nullable<UserExceptionInterface> = null;
  public errorRevision: Nullable<Revision> = null;

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

  public children: Nullable<Map<PropertyKey | RawReactive, RawReactive>> = null;

  public debugLabel?: string | undefined;
  public debug?:
    | {
        isPrimitive: boolean;
      }
    | undefined;

  constructor(type: K) {
    this[REFERENCE] = type;
  }
}

function updateReactive(reactive: Reactive, value: unknown): ReactiveResult<void> {
  if (reactive.update) {
    reactive.update(value);
  } else {
    if (reactive.tag === CONSTANT_TAG) {
      return Err(
        UserException.from(
          Error(`Cannot update a constant value (${describeRef(reactive as SomeReactive)})`),
          `Cannot update a constant value (${describeRef(reactive as SomeReactive)})`
        )
      );
    }

    let tag = reactive.tag as DirtyableTag | UpdatableTag | null;

    if (import.meta.env.DEV) {
      assert(
        tag === null || tag[TAG_TYPE] === DIRYTABLE_TAG_ID || tag[TAG_TYPE] === UPDATABLE_TAG_ID,
        `Expected a dirtyable or updatable tag (${describeRef(reactive as SomeReactive)})`
      );
    }

    reactive.lastValue = value;

    if (tag === null) {
      reactive.tag = createTag();
    } else {
      dirtyTag(tag);
    }
  }

  return Ok(undefined);
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

  if (import.meta.env.DEV && debugLabel) {
    ref.debugLabel = debugLabel;
  }

  return ref as RETURN_TYPE;
}

export function ConstantError(
  error: UserExceptionInterface,
  debugLabel?: false | string
): ConstantReactiveError {
  const ref = new Reactive(CONSTANT_ERROR);

  ref.tag = CONSTANT_TAG;
  ref.error = error;

  if (import.meta.env.DEV && debugLabel) {
    ref.debugLabel = debugLabel;
  }

  return ref as RETURN_TYPE;
}

export function MutableCell<T>(value: T, debugLabel?: false | string): MutableReactiveCell<T> {
  const ref = new Reactive(MUTABLE_CELL);

  const tag = (ref.tag = createUpdatableTag());
  ref.lastValue = value;

  ref.update = (value) => {
    ref.lastValue = value;
    dirtyTag(tag);
  };

  if (import.meta.env.DEV && debugLabel) {
    ref.debugLabel = debugLabel;
  }

  return ref as RETURN_TYPE;
}

export function ReadonlyCell<T>(value: T, debugLabel?: false | string): ReactiveCell<T> {
  const ref = new Reactive(READONLY_CELL);

  ref.tag = CONSTANT_TAG;
  ref.lastValue = value;

  if (import.meta.env.DEV && debugLabel) {
    ref.debugLabel = debugLabel;
  }

  return ref as RETURN_TYPE;
}

/**
 * A fallible formula invokes user code. If the user code throws an exception, the formula returns
 * an error {@linkcode Result}. Otherwise, it returns an ok {@linkcode Result}.
 */
export function FallibleFormula<T = unknown>(
  compute: () => T,
  debugLabel?: false | string
): FallibleReactiveFormula<T> {
  const ref = new Reactive<T>(FALLIBLE_FORMULA);

  ref.compute = () => {
    try {
      return compute();
    } catch (e) {
      setError(ref, UserException.from(e, `An error occured in ${ref.debugLabel}`));
    }
  };

  if (import.meta.env.DEV && debugLabel) {
    ref.debugLabel = `(result of a \`${debugLabel}\` helper)`;
  }

  return ref as RETURN_TYPE;
}

/**
 * The `compute` function must be infallible and convert any errors to results.
 */
export function ResultFormula<T = unknown>(
  compute: () => ReactiveResult<T>,
  debugLabel?: false | string
) {
  const ref = new Reactive<T>(FALLIBLE_FORMULA);

  ref.compute = () => {
    const result = compute();

    switch (result.type) {
      case 'ok':
        return result.value;
      case 'err':
        setError(ref, result.value);
    }
  };

  if (import.meta.env.DEV && debugLabel) {
    ref.debugLabel = `(result of a \`${debugLabel}\` helper)`;
  }

  return ref as RETURN_TYPE;
}

export function ResultAccessor<T = unknown>(
  options: {
    get: () => ReactiveResult<T | undefined>;
    set: (val: T) => ReactiveResult<void>;
  },
  debugLabel?: false | string
): SomeReactive<T> {
  const { get, set } = options;

  const ref = new Reactive<T>(ACCESSOR);

  ref.compute = () => {
    const result = get();

    switch (result.type) {
      case 'ok':
        return result.value;
      case 'err':
        setError(ref, result.value);
    }
  };

  ref.update = (value: T) => {
    const setResult = set(value);

    if (setResult.type === 'ok') {
      ref.lastValue = value;
    } else {
      setError(ref, setResult.value);
    }
  };

  if (import.meta.env.DEV) {
    ref.debugLabel = debugLabel ? `(${debugLabel} accessor)` : `(accessor)`;
  }

  return ref as RETURN_TYPE;
}

export function Accessor<T = unknown>(
  options: { get: () => T; set: (val: T) => void },
  debugLabel?: false | string
): SomeReactive<T> {
  const { get, set } = options;

  const ref = new Reactive<T>(ACCESSOR);

  ref.compute = () => {
    try {
      return get();
    } catch (e) {
      setError(ref, UserException.from(e, `An error occured in ${ref.debugLabel}`));
    }
  };

  ref.update = (value: T) => {
    try {
      set(value);
      return value;
    } catch (e) {
      setError(ref, UserException.from(e, `An error occured setting ${ref.debugLabel}`));
    }
  };

  if (import.meta.env.DEV) {
    ref.debugLabel = debugLabel ? `(${debugLabel} accessor)` : `(accessor)`;
  }

  return ref as RETURN_TYPE;
}

function rawValueForRef<T>(ref: Reactive<T>): T {
  const { tag, compute, lastRevision } = ref;

  if (ref.tag === CONSTANT_TAG) {
    return ref.lastValue as T;
  }

  if (compute === null) {
    if (tag) consumeTag(tag);
    return ref.lastValue as T;
  }

  if (tag !== null && validateTag(tag, lastRevision)) {
    consumeTag(tag);
    return ref.lastValue as T;
  }

  // a data cell
  if (!compute) {
    ref.tag ??= createTag();
    consumeTag(ref.tag);
    return ref.lastValue as T;
  }

  // a formula
  const newTag = track(
    () => {
      const result = compute();
      ref.lastValue = ref.error ? null : (result as T);
    },
    import.meta.env.DEV && ref.debugLabel
  );

  ref.tag = newTag;
  updateRevision(ref, valueForTag(newTag));
  consumeTag(newTag);
  return ref.lastValue as T;
}

function setError<T>(reactive: Reactive<T>, error: UserExceptionInterface) {
  reactive.lastValue = null;
  reactive.error = error;
  reactive.errorRevision = $REVISION;
}

function updateRevision<T>(reactive: Reactive<T>, revision: Revision) {
  if (reactive.errorRevision) {
    reactive.lastRevision = Math.max(revision, reactive.errorRevision);
  } else {
    reactive.lastRevision = revision;
  }
}

/**
 * An infallible formula does not invoke user code. If an infallible formula's compute function
 * throws an error, it's a bug and there is no error recovery.
 */
export function InfallibleFormula<T = unknown>(
  compute: () => T,
  debugLabel?: false | string
): InfallibleReactiveFormula<T> {
  const ref = new Reactive<T>(INFALLIBLE_FORMULA);

  ref.compute = compute;

  if (import.meta.env.DEV && debugLabel) {
    ref.debugLabel = `(result of a \`${debugLabel}\` helper)`;
  }

  return ref as RETURN_TYPE;
}

export function createPrimitiveCell<T>(value: T): ReadonlyReactiveCell<T> {
  const ref = ReadonlyCell(value);

  if (import.meta.env.DEV) {
    ref.debugLabel = `{primitive:${value}}`;
    ref.debug = { isPrimitive: true };
  }

  return ref as RETURN_TYPE;
}

function initializeChildren(parent: SomeReactive) {
  let children = parent.children;

  if (children === null) {
    children = parent.children = new Map();
  }

  return children;
}

export function toReadonly<T>(reactive: SomeReactive<T>): FallibleReactiveFormula<T> {
  return FallibleFormula(() => unwrapReactive(reactive));
}

export function toMut<T>(maybeMut: SomeReactive<T>): SomeReactive<T> {
  const reactive = maybeMut as Reactive;

  return ResultAccessor({
    get: () => readReactive(maybeMut),
    set: (value: unknown) => updateReactive(reactive, value),
  });
}

export function getReactivePath(reactive: SomeReactive, path: string[]): SomeReactive {
  let current: SomeReactive = reactive;

  for (const part of path) {
    current = getReactiveProperty(current, part);
  }

  return current;
}

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
    if (import.meta.env.DEV) {
      child.debugLabel = childDebug(parentReactive, property);
    }

    children.set(property, child);
    return child as RETURN_TYPE;
  };

  if (type === DEEPLY_CONSTANT) {
    // We need an extra try/catch here because any reactive value can be turned into a deeply
    // constant value.
    try {
      const parent = readReactive(parentReactive);

      if (parent.type === 'err') {
        return initialize(ConstantError(parent.value));
      } else {
        if (isDict(parent.value)) {
          return initialize(DeeplyConstant(parent.value[property as keyof typeof parent.value]));
        }
      }
    } catch (e) {
      return initialize(
        ConstantError(
          UserException.from(
            e,
            `An error occured when getting a property from a deeply constant reactive (${childDebug(
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
      const parentResult = readReactive(parentReactive);

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
                `An error occured when setting a property on a deeply constant reactive (${childDebug(
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

  // @fixme updates

  if (import.meta.env.DEV) {
    child.debugLabel = childDebug(parentReactive, property);
  }

  return initialize(child);
}

/**
 * @category devmode
 */
function childDebug(parentReactive: SomeReactive, path: PropertyKey) {
  if (typeof path === 'symbol') {
    return `${parentReactive.debugLabel}[${String(path)}]`;
  }

  const IDENT = /^\p{XID_Start}\p{XID_Continue}*$/u;

  if (IDENT.test(String(path))) {
    return `${parentReactive.debugLabel}.${path}`;
  } else {
    return `${parentReactive.debugLabel}[${JSON.stringify(path)}]`;
  }
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
      return (reactive as Reactive).tag === CONSTANT_TAG;
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

export function clearRefError(_ref: SomeReactive) {
  _ref.error = null;
}

/**
 * This is generally not what you want, as it rethrows errors. It's useful in testing and console
 * situations, and as a transitional mechanism away from valueForRef.
 */
export function unwrapReactive<T>(reactive: SomeReactive<T>): T {
  return unwrapResult(readReactive(reactive));
}

export function readReactive<T>(reactive: SomeReactive<T>): ReactiveResult<T> {
  if (reactive.error) {
    return Err(reactive.error);
  } else {
    const value = rawValueForRef(reactive as Reactive<T>);
    return reactive.error ? Err(reactive.error) : Ok(value);
  }
}

export function updateRefWithResult<T>(ref: SomeReactive<T>, value: ReactiveResult<T>) {
  switch (value.type) {
    case 'err':
      setError(ref as Reactive, value.value);
      break;
    case 'ok':
      updateRef(ref, value.value);
      break;
  }
}

export function updateRef(_ref: SomeReactive, value: unknown) {
  const ref = _ref as Reactive;

  const update = expect(ref.update, 'called update on a non-updatable reference');

  update(value);
}

/**
 * This should inline to nothing in prod mode: https://tiny.katz.zone/IkhJV5
 */
const TYPES = [
  'mutable cell',
  'readonly cell',
  'deeply constant',
  'fallible formula',
  'infallible formula',
  'invokable',
  'constant error',
] as const satisfies {
  // verify that the union is exhaustive
  [P in ReactiveType]: P extends MutableCellType
    ? 'mutable cell'
    : P extends DeeplyConstantType
    ? 'deeply constant'
    : P extends ReadonlyCellType
    ? 'readonly cell'
    : P extends AccessorType
    ? 'invokable'
    : P extends InfallibleFormulaType
    ? 'infallible formula'
    : P extends FallibleFormulaType
    ? 'fallible formula'
    : P extends ConstantErrorType
    ? 'constant error'
    : P extends never
    ? never
    : { value: 'not exhaustive'; reason: `you're missing types in the conditional` };
};

function describeRef(ref: SomeReactive): string | undefined {
  if (import.meta.env.DEV) {
    if (ref.debugLabel) {
      return ref.debugLabel;
    }

    return `{${TYPES[ref[REFERENCE]]} reference}`;
  } else {
    return ref.debugLabel;
  }
}

export let createDebugAliasRef:
  | undefined
  | ((debugLabel: string, inner: SomeReactive) => SomeReactive);

if (import.meta.env.DEV) {
  createDebugAliasRef = (debugLabel: string, inner: SomeReactive) => {
    const update = isUpdatableRef(inner) ? (value: unknown) => updateRef(inner, value) : null;

    const ref = update
      ? Accessor({ get: () => unwrapReactive(inner), set: update }, debugLabel)
      : FallibleFormula(() => unwrapReactive(inner), debugLabel);

    ref[REFERENCE] = inner[REFERENCE];

    ref.debugLabel = debugLabel;

    return ref;
  };
}
