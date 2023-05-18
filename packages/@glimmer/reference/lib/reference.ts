import { getProp, setProp } from '@glimmer/global-context';
import type {
  ComputeReference,
  ConstantReference,
  InvokableReference,
  Nullable,
  Reference,
  ReferenceType,
  UnboundReference,
} from '@glimmer/interfaces';
import { expect, isDict } from '@glimmer/util';
import {
  CONSTANT_TAG,
  consumeTag,
  INITIAL,
  type Revision,
  type Tag,
  track,
  validateTag,
  valueForTag,
} from '@glimmer/validator';

const CONSTANT: ConstantReference = 0;
const COMPUTE: ComputeReference = 1;
const UNBOUND: UnboundReference = 2;
const INVOKABLE: InvokableReference = 3;

export type { Reference as default };
export type { Reference };

//////////

export interface ReferenceEnvironment {
  getProp(obj: unknown, path: string): unknown;
  setProp(obj: unknown, path: string, value: unknown): unknown;
}

class ReferenceImpl<T = unknown> implements Reference<T> {
  static _isInvokableRef_ = (ref: Reference) => {
    return (ref as ReferenceImpl).#type === INVOKABLE;
  };

  static _isUnboundRef_ = (ref: Reference) => {
    return (ref as ReferenceImpl).#type === UNBOUND;
  };

  static _getType_ = (ref: Reference) => {
    return (ref as ReferenceImpl).#type;
  };

  static _is_ = (value: unknown): value is Reference => {
    return !!(value && value instanceof ReferenceImpl);
  };

  static _childRefFor_ = (_parentRef: Reference, path: string): Reference => {
    const parentRef = _parentRef as ReferenceImpl;

    let children = parentRef.#children;
    let child: Reference;

    if (children === null) {
      children = parentRef.#children = new Map();
    } else {
      child = children.get(path)!;

      if (child !== undefined) {
        return child;
      }
    }

    if (isUnboundRef(parentRef)) {
      const parent = valueForRef(parentRef);

      if (isDict(parent)) {
        child = createUnboundRef(
          (parent as Record<string, unknown>)[path],
          import.meta.env.DEV && `${parentRef.debugLabel}.${path}`
        );
      } else {
        child = UNDEFINED_REFERENCE;
      }
    } else {
      child = createComputeRef(
        () => {
          const parent = valueForRef(parentRef);

          if (isDict(parent)) {
            return getProp(parent, path);
          }
        },
        (val) => {
          const parent = valueForRef(parentRef);

          if (isDict(parent)) {
            return setProp(parent, path, val);
          }
        }
      );

      if (import.meta.env.DEV) {
        child.debugLabel = `${parentRef.debugLabel}.${path}`;
      }
    }

    children.set(path, child);

    return child;
  };

  static _valueForRef_ = <T>(_ref: Reference<T>): T => {
    const ref = _ref as ReferenceImpl<T>;

    let { tag } = ref;

    if (tag === CONSTANT_TAG) {
      return ref.lastValue as T;
    }

    const { lastRevision } = ref;
    let lastValue;

    if (tag === null || !validateTag(tag, lastRevision)) {
      const newTag = track(() => {
        lastValue = ref.lastValue = ref.#compute!();
      }, import.meta.env.DEV && ref.debugLabel);

      tag = ref.tag = newTag;

      ref.lastRevision = valueForTag(newTag);
    } else {
      lastValue = ref.lastValue;
    }

    consumeTag(tag);

    return lastValue as T;
  };

  static _createComputeRef_ = <T = unknown>(
    compute: () => T,
    update: Nullable<(value: T) => void> = null,
    debugLabel: false | string = 'unknown'
  ): Reference<T> => {
    const ref = new ReferenceImpl<T>(COMPUTE);

    ref.#compute = compute;
    ref.#update = update;

    if (import.meta.env.DEV) {
      ref.debugLabel = `(result of a \`${debugLabel}\` helper)`;
    }

    return ref;
  };

  static _createInvokableRef_ = (inner: Reference): Reference => {
    const ref = new ReferenceImpl(INVOKABLE, inner.debugLabel);

    ref._updateCompute_(() => valueForRef(inner));
    ref.#update = (value) => updateRef(inner, value);

    return ref;
  };

  static _isConstRef_ = (ref: Reference) => (ref as ReferenceImpl).tag === CONSTANT_TAG;
  static _isUpdatableRef_ = (ref: Reference) => (ref as ReferenceImpl).#update !== null;

  static _updateRef_ = (ref: Reference, value: unknown) =>
    void expect(
      (ref as ReferenceImpl).#update,
      'called update on a non-updatable reference'
    )(value);

  static _childRefFromParts_ = (root: Reference, parts: string[]): Reference => {
    let reference = root;
    for (const part of parts) reference = childRefFor(reference, part);
    return reference;
  };

  static _createDebugAliasRef_ = import.meta.env.DEV
    ? (debugLabel: string, inner: Reference) => {
        const update = isUpdatableRef(inner) ? (value: unknown) => updateRef(inner, value) : null;

        const ref = new ReferenceImpl(
          getType(inner),
          /*@__PURE__*/ `(result of a \`${debugLabel}\` helper)`
        );

        ref._updateCompute_(() => valueForRef(inner));
        ref.#update = update;

        if (import.meta.env.DEV) {
          ref.debugLabel = `(result of a \`${debugLabel}\` helper)`;
        }

        return ref;
      }
    : undefined;

  #type: ReferenceType;
  public tag: Nullable<Tag> = null;
  public lastRevision: Revision = INITIAL;
  public lastValue?: T;

  #children: Nullable<Map<string | Reference, Reference>> = null;

  #compute: Nullable<() => T> = null;
  #update: Nullable<(val: T) => void> = null;

  public debugLabel: string | undefined;

  constructor(type: ReferenceType, debugLabel?: string) {
    this.#type = type;

    if (import.meta.env.DEV) {
      this.debugLabel = debugLabel;
    }
  }

  _updateChildren_(children: Map<string | Reference, Reference>): void {
    this.#children = children;
  }

  _updateCompute_(compute: Nullable<() => T>): void {
    this.#compute = compute;
  }
}

export function createPrimitiveRef(value: unknown): Reference {
  const ref = new ReferenceImpl(UNBOUND);

  ref.tag = CONSTANT_TAG;
  ref.lastValue = value;

  if (import.meta.env.DEV) {
    ref.debugLabel = String(value);
  }

  return ref;
}

export const UNDEFINED_REFERENCE = createPrimitiveRef(undefined);
export const NULL_REFERENCE = createPrimitiveRef(null);
export const TRUE_REFERENCE = createPrimitiveRef(true);
export const FALSE_REFERENCE = createPrimitiveRef(false);

export function createConstRef(value: unknown, debugLabel: false | string): Reference {
  const ref = new ReferenceImpl(CONSTANT);

  ref.lastValue = value;
  ref.tag = CONSTANT_TAG;

  if (import.meta.env.DEV) {
    ref.debugLabel = debugLabel as string;
  }

  return ref;
}

export function createUnboundRef(value: unknown, debugLabel: false | string): Reference {
  const ref = new ReferenceImpl(UNBOUND);

  ref.lastValue = value;
  ref.tag = CONSTANT_TAG;

  if (import.meta.env.DEV) {
    ref.debugLabel = debugLabel as string;
  }

  return ref;
}

export function createReadOnlyRef(ref: Reference): Reference {
  if (!isUpdatableRef(ref)) return ref;

  return createComputeRef(() => valueForRef(ref), null, ref.debugLabel);
}

export const isInvokableRef = ReferenceImpl._isInvokableRef_;
export const isRef = ReferenceImpl._is_;
export const childRefFor = ReferenceImpl._childRefFor_;
export const valueForRef = ReferenceImpl._valueForRef_;
export const createComputeRef = ReferenceImpl._createComputeRef_;
export const isUpdatableRef = ReferenceImpl._isUpdatableRef_;
export const updateRef = ReferenceImpl._updateRef_;
export const childRefFromParts = ReferenceImpl._childRefFromParts_;
export const createDebugAliasRef = ReferenceImpl._createDebugAliasRef_;
export const createInvokableRef = ReferenceImpl._createInvokableRef_;
export const isConstRef = ReferenceImpl._isConstRef_;
const isUnboundRef = ReferenceImpl._isUnboundRef_;
const getType = ReferenceImpl._getType_;
