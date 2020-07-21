import { getProp, setProp } from '@glimmer/global-context';
import { Option, expect, symbol, isDict, _WeakSet } from '@glimmer/util';
import {
  Tag,
  CONSTANT_TAG,
  Revision,
  validateTag,
  consumeTag,
  INITIAL,
  beginTrackFrame,
  endTrackFrame,
  valueForTag,
} from '@glimmer/validator';
import { DEBUG } from '@glimmer/env';

export const REFERENCE: unique symbol = symbol('REFERENCE');

const enum ReferenceType {
  Constant,
  Compute,
  Unbound,
  Invokable,
}

export interface Reference<_T = unknown> {
  [REFERENCE]: ReferenceType;
  debugLabel?: string;
}

export default Reference;

//////////

export interface ReferenceEnvironment {
  getProp(obj: unknown, path: string): unknown;
  setProp(obj: unknown, path: string, value: unknown): unknown;
}

class ReferenceImpl<T = unknown> implements Reference {
  [REFERENCE]: ReferenceType;
  public tag: Option<Tag> = null;
  public lastRevision: Revision = INITIAL;
  public lastValue?: T;

  public children: Option<Map<string | Reference, Reference>> = null;

  public compute: Option<() => T> = null;
  public update: Option<(val: T) => void> = null;

  public debugLabel?: string;

  constructor(type: ReferenceType) {
    this[REFERENCE] = type;
  }
}

export function createPrimitiveRef(value: unknown): Reference {
  let ref = new ReferenceImpl(ReferenceType.Unbound);

  ref.tag = CONSTANT_TAG;
  ref.lastValue = value;

  if (DEBUG) {
    ref.debugLabel = String(value);
  }

  return ref;
}

export const UNDEFINED_REFERENCE = createPrimitiveRef(undefined);
export const NULL_REFERENCE = createPrimitiveRef(null);
export const TRUE_REFERENCE = createPrimitiveRef(true);
export const FALSE_REFERENCE = createPrimitiveRef(false);

export function createConstRef(value: unknown, debugLabel = 'this'): Reference {
  let ref = new ReferenceImpl(ReferenceType.Constant);

  ref.lastValue = value;
  ref.tag = CONSTANT_TAG;

  if (DEBUG) {
    ref.debugLabel = debugLabel;
  }

  return ref;
}

export function createUnboundRef(value: unknown, debugLabel = 'this'): Reference {
  let ref = new ReferenceImpl(ReferenceType.Unbound);

  ref.lastValue = value;
  ref.tag = CONSTANT_TAG;

  if (DEBUG) {
    ref.debugLabel = debugLabel;
  }

  return ref;
}

export function createComputeRef<T = unknown>(
  compute: () => T,
  update: Option<(value: T) => void> = null,
  debugLabel = 'unknown'
): Reference<T> {
  let ref = new ReferenceImpl<T>(ReferenceType.Compute);

  ref.compute = compute;
  ref.update = update;

  if (DEBUG) {
    ref.debugLabel = `(result of a \`${debugLabel}\` helper)`;
  }

  return ref;
}

export function createReadOnlyRef(ref: Reference): Reference {
  let original = ref as ReferenceImpl;

  let { update } = original;

  if (update === null) return original;

  let copy = new ReferenceImpl(original[REFERENCE]);

  copy.compute = original.compute!;

  if (DEBUG) {
    copy.debugLabel = original.debugLabel;
  }

  return copy;
}

export function isInvokableRef(ref: Reference) {
  return ref[REFERENCE] === ReferenceType.Invokable;
}

export function createInvokableRef(inner: Reference): Reference {
  let ref = createComputeRef(
    () => valueForRef(inner),
    value => updateRef(inner, value)
  );
  ref.debugLabel = inner.debugLabel;
  ref[REFERENCE] = ReferenceType.Invokable;

  return ref;
}

export function isConstRef(_ref: Reference) {
  let ref = _ref as ReferenceImpl;

  return ref.tag === CONSTANT_TAG;
}

export function isUpdatableRef(_ref: Reference) {
  let ref = _ref as ReferenceImpl;

  return ref.update !== null;
}

export function valueForRef<T>(_ref: Reference<T>): T {
  let ref = _ref as ReferenceImpl<T>;

  let { tag } = ref;

  if (tag === CONSTANT_TAG) {
    return ref.lastValue as T;
  }

  let { lastRevision } = ref;
  let lastValue;

  if (tag === null || !validateTag(tag, lastRevision)) {
    let { compute } = ref;

    beginTrackFrame(DEBUG && ref.debugLabel);
    lastValue = ref.lastValue = compute!();
    tag = ref.tag = endTrackFrame();
    ref.lastRevision = valueForTag(tag);
  } else {
    lastValue = ref.lastValue;
  }

  consumeTag(tag);

  return lastValue as T;
}

export function updateRef(_ref: Reference, value: unknown) {
  let ref = _ref as ReferenceImpl;

  let update = expect(ref.update, 'called update on a non-updatable reference');

  update(value);
}

export function childRefFor(_parentRef: Reference, path: string): Reference {
  let parentRef = _parentRef as ReferenceImpl;

  let type = parentRef[REFERENCE];

  let children = parentRef.children;
  let child: Reference;

  if (children === null) {
    children = parentRef.children = new Map();
  } else {
    child = children.get(path)!;

    if (child !== undefined) {
      if (DEBUG) {
        // TODO: Make this return a new reference for debug tracing
        return child;
      } else {
        return child;
      }
    }
  }

  if (type === ReferenceType.Unbound) {
    let parent = valueForRef(parentRef);

    if (isDict(parent)) {
      child = createUnboundRef((parent as Record<string, unknown>)[path]);

      if (DEBUG) {
        child.debugLabel = `${parentRef.debugLabel}.${path}`;
      }
    } else {
      child = UNDEFINED_REFERENCE;
    }
  } else {
    child = createComputeRef(
      () => {
        let parent = valueForRef(parentRef);

        if (isDict(parent)) {
          return getProp(parent, path);
        }
      },
      val => {
        let parent = valueForRef(parentRef);

        if (isDict(parent)) {
          return setProp(parent, path, val);
        }
      }
    );

    if (DEBUG) {
      child.debugLabel = `${parentRef.debugLabel}.${path}`;
    }
  }

  children.set(path, child);

  return child;
}

export function childRefFromParts(root: Reference, parts: string[]): Reference {
  let reference = root;

  for (let i = 0; i < parts.length; i++) {
    reference = childRefFor(reference, parts[i]);
  }

  return reference;
}

export let createDebugAliasRef: undefined | ((debugLabel: string, inner: Reference) => Reference);

if (DEBUG) {
  createDebugAliasRef = (debugLabel: string, inner: Reference) => {
    let update = isUpdatableRef(inner) ? (value: unknown) => updateRef(inner, value) : null;
    let ref = createComputeRef(() => valueForRef(inner), update);

    ref[REFERENCE] = inner[REFERENCE];

    ref.debugLabel = debugLabel;

    return ref;
  };
}
