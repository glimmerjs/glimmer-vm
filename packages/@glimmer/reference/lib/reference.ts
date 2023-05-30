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
  createCache,
  getValue,
} from '@glimmer/validator';

const CONSTANT: ConstantReference = 0;
const COMPUTE: ComputeReference = 1;
const UNBOUND: UnboundReference = 2;
const INVOKABLE: InvokableReference = 3;

//////////

export interface ReferenceEnvironment {
  getProp(parent: unknown, path: string): unknown;
  setProp(parent: unknown, path: string, value: unknown): unknown;
}

class ReferenceImpl<T = unknown> implements Reference<T> {
  static _isInvokableRef_ = (reference: Reference) => {
    return (reference as ReferenceImpl).#type === INVOKABLE;
  };

  static _isUnboundRef_ = (reference: Reference) => {
    return (reference as ReferenceImpl).#type === UNBOUND;
  };

  static _getType_ = (reference: Reference) => {
    return (reference as ReferenceImpl).#type;
  };

  static _is_ = (value: unknown): value is Reference => {
    return !!(value && value instanceof ReferenceImpl);
  };

  static _childRefFor_ = (_parentReference: Reference, path: string): Reference => {
    let parentReference = _parentReference as ReferenceImpl;

    let children = parentReference.#children;
    let child: Reference;

    if (children === null) {
      children = parentReference.#children = new Map();
    } else {
      child = children.get(path)!;

      if (child !== undefined) {
        return child;
      }
    }

    if (isUnboundReference(parentReference)) {
      let parent = valueForRef(parentReference);

      child = isDict(parent)
        ? createUnboundRef(
            (parent as Record<string, unknown>)[path],
            import.meta.env.DEV && `${parentReference.debugLabel}.${path}`
          )
        : UNDEFINED_REFERENCE;
    } else {
      child = createComputeRef(
        () => {
          let parent = valueForRef(parentReference);

          if (isDict(parent)) {
            return getProp(parent, path);
          }
        },
        (value) => {
          let parent = valueForRef(parentReference);

          if (isDict(parent)) {
            return setProp(parent, path, value);
          }
        }
      );

      if (import.meta.env.DEV) {
        child.debugLabel = `${parentReference.debugLabel}.${path}`;
      }
    }

    children.set(path, child);

    return child;
  };

  static _valueForRef_ = <T>(_reference: Reference<T>): T => {
    let reference = _reference as ReferenceImpl<T>;

    let { tag } = reference;

    if (tag === CONSTANT_TAG) {
      return reference.lastValue as T;
    }

    let { lastRevision } = reference;
    let lastValue;

    if (tag === null || !validateTag(tag, lastRevision)) {
      let newTag = track(() => {
        lastValue = reference.lastValue = reference.#compute!();
      }, import.meta.env.DEV && reference.debugLabel);

      tag = reference.tag = newTag;

      reference.lastRevision = valueForTag(newTag);
    } else {
      lastValue = reference.lastValue;
    }

    consumeTag(tag);

    return lastValue as T;
  };

  static _createComputeRef_ = <T = unknown>(
    compute: () => T,
    update: Nullable<(value: T) => void> = null,
    debugLabel: false | string = 'unknown'
  ): Reference<T> => {
    let reference = new ReferenceImpl<T>(COMPUTE);

    reference.#compute = compute;
    reference.#update = update;

    if (import.meta.env.DEV) {
      reference.debugLabel = `(result of a \`${debugLabel}\` helper)`;
    }

    return reference;
  };

  static _createInvokableRef_ = (inner: Reference): Reference => {
    let reference = new ReferenceImpl(INVOKABLE, inner.debugLabel);

    reference._updateCompute_(() => valueForRef(inner));
    reference.#update = (value) => updateRef(inner, value);

    return reference;
  };

  static _isConstRef_ = (reference: Reference) => (reference as ReferenceImpl).tag === CONSTANT_TAG;
  static _isUpdatableRef_ = (reference: Reference) => (reference as ReferenceImpl).#update !== null;

  static _updateRef_ = (reference: Reference, value: unknown) =>
    void expect(
      (reference as ReferenceImpl).#update,
      'called update on a non-updatable reference'
    )(value);

  static _childRefFromParts_ = (root: Reference, parts: string[]): Reference => {
    let reference = root;
    for (let part of parts) reference = childRefFor(reference, part);
    return reference;
  };

  static _createDebugAliasRef_ = import.meta.env.DEV
    ? (debugLabel: string, inner: Reference) => {
        let update = isUpdatableRef(inner) ? (value: unknown) => updateRef(inner, value) : null;

        let reference = new ReferenceImpl(
          getType(inner),
          /*@__PURE__*/ `(result of a \`${debugLabel}\` helper)`
        );

        reference._updateCompute_(() => valueForRef(inner));
        reference.#update = update;

        if (import.meta.env.DEV) {
          reference.debugLabel = `(result of a \`${debugLabel}\` helper)`;
        }

        return reference;
      }
    : undefined;

  #type: ReferenceType;
  public tag: Nullable<Tag> = null;
  public lastRevision: Revision = INITIAL;
  public lastValue?: T;

  #children: Nullable<Map<string | Reference, Reference>> = null;

  #compute: Nullable<() => T> = null;
  #update: Nullable<(value: T) => void> = null;

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
  let reference = new ReferenceImpl(UNBOUND);

  reference.tag = CONSTANT_TAG;
  reference.lastValue = value;

  if (import.meta.env.DEV) {
    reference.debugLabel = String(value);
  }

  return reference;
}

export const UNDEFINED_REFERENCE = createPrimitiveRef(void 0);
export const NULL_REFERENCE = createPrimitiveRef(null);
export const TRUE_REFERENCE = createPrimitiveRef(true);
export const FALSE_REFERENCE = createPrimitiveRef(false);

export function createConstRef<T>(value: T, debugLabel: false | string): Reference<T> {
  let reference = new ReferenceImpl(CONSTANT);

  reference.lastValue = value;
  reference.tag = CONSTANT_TAG;

  if (import.meta.env.DEV) {
    reference.debugLabel = debugLabel as string;
  }

  return reference;
}

export function createUnboundRef(value: unknown, debugLabel: false | string): Reference {
  let reference = new ReferenceImpl(UNBOUND);

  reference.lastValue = value;
  reference.tag = CONSTANT_TAG;

  if (import.meta.env.DEV) {
    reference.debugLabel = debugLabel as string;
  }

  return reference;
}

export function createReadOnlyRef(reference: Reference): Reference {
  if (!isUpdatableRef(reference)) return reference;

  return createComputeRef(() => valueForRef(reference), null, reference.debugLabel);
}

export function _createCacheRef_<T>(fn: () => T, debuggingLabel?: string | false): Reference<T> {
  let cache = createCache(fn, debuggingLabel);
  return createComputeRef(() => getValue(cache), null, debuggingLabel);
}

export function _tagForRef_(reference: Reference): Nullable<Tag> {
  return (reference as ReferenceImpl).tag;
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
const isUnboundReference = ReferenceImpl._isUnboundRef_;
const getType = ReferenceImpl._getType_;

export type { Reference as default, Reference } from '@glimmer/interfaces';
