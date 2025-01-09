import type {
  ComputeReferenceId,
  ConstantReferenceId,
  InvokableReferenceId,
  Nullable,
  Reference,
  ReferenceSymbol,
  ReferenceType,
  Revision,
  UnboundReferenceId,
} from '@glimmer/interfaces';
import type { Tag } from '@glimmer/validator';
import { expect } from '@glimmer/debug-util';
import { valueForRef } from '@glimmer/fundamental';
import { context } from '@glimmer/global-context';
import { symbols } from '@glimmer/state';
import { isDict } from '@glimmer/util';
import { CONSTANT_TAG, INITIAL } from '@glimmer/validator';

const REFERENCE: ReferenceSymbol = symbols.REFERENCE;

const CONSTANT: ConstantReferenceId = 0;
const COMPUTE: ComputeReferenceId = 1;
const UNBOUND: UnboundReferenceId = 2;
const INVOKABLE: InvokableReferenceId = 3;

export type { Reference };

//////////

export interface ReferenceEnvironment {
  getProp(obj: unknown, path: string): unknown;
  setProp(obj: unknown, path: string, value: unknown): unknown;
}

class ReferenceImpl<T = unknown> implements Reference<T> {
  [REFERENCE]: ReferenceType;
  public tag: Nullable<Tag> = null;
  public lastRevision: Revision = INITIAL;
  public lastValue?: T;

  public children: Nullable<Map<string | Reference, Reference>> = null;

  public compute: Nullable<() => T> = null;
  public update: Nullable<(val: T) => void> = null;

  public debugLabel?: string;

  constructor(type: ReferenceType) {
    this[REFERENCE] = type;
  }
}

export function createPrimitiveRef<T extends string | symbol | number | boolean | null | undefined>(
  value: T
): Reference<T> {
  const ref = new ReferenceImpl<T>(UNBOUND);

  ref.tag = CONSTANT_TAG;
  ref.lastValue = value;

  if (import.meta.env.DEV) {
    ref.debugLabel = String(value);
  }

  return ref;
}

export const UNDEFINED_REFERENCE: Reference<undefined> = createPrimitiveRef(undefined);
export const NULL_REFERENCE: Reference<null> = createPrimitiveRef(null);
export const TRUE_REFERENCE: Reference<true> = createPrimitiveRef(true as const);
export const FALSE_REFERENCE: Reference<false> = createPrimitiveRef(false as const);

export function createConstRef<T>(value: T, debugLabel: false | string): Reference<T> {
  const ref = new ReferenceImpl<T>(CONSTANT);

  ref.lastValue = value;
  ref.tag = CONSTANT_TAG;

  if (import.meta.env.DEV) {
    ref.debugLabel = debugLabel as string;
  }

  return ref;
}

export function createUnboundRef<T>(value: T, debugLabel: false | string): Reference<T> {
  const ref = new ReferenceImpl<T>(UNBOUND);

  ref.lastValue = value;
  ref.tag = CONSTANT_TAG;

  if (import.meta.env.DEV) {
    ref.debugLabel = debugLabel as string;
  }

  return ref;
}

export function createComputeRef<T = unknown>(
  compute: () => T,
  update: Nullable<(value: T) => void> = null,
  debugLabel: false | string = 'unknown'
): Reference<T> {
  const ref = new ReferenceImpl<T>(COMPUTE);

  ref.compute = compute;
  ref.update = update;

  if (import.meta.env.DEV) {
    ref.debugLabel = `(result of a \`${debugLabel}\` helper)`;
  }

  return ref;
}

export function createReadOnlyRef(ref: Reference): Reference {
  if (!isUpdatableRef(ref)) return ref;

  return createComputeRef(() => valueForRef(ref), null, ref.debugLabel);
}

export function isInvokableRef(ref: Reference): boolean {
  return ref[REFERENCE] === INVOKABLE;
}

export function createInvokableRef(inner: Reference): Reference {
  const ref = createComputeRef(
    () => valueForRef(inner),
    (value) => updateRef(inner, value)
  );
  ref.debugLabel = inner.debugLabel;
  ref[REFERENCE] = INVOKABLE;

  return ref;
}

export function isConstRef(_ref: Reference): boolean {
  const ref = _ref as ReferenceImpl;

  return ref.tag === CONSTANT_TAG;
}

export function isUpdatableRef(_ref: Reference): boolean {
  const ref = _ref as ReferenceImpl;

  return ref.update !== null;
}

export function updateRef(_ref: Reference, value: unknown): void {
  const ref = _ref as ReferenceImpl;

  const update = expect(ref.update, 'called update on a non-updatable reference');

  update(value);
}

export function childRefFor(_parentRef: Reference, path: string): Reference {
  const parentRef = _parentRef as ReferenceImpl;

  const type = parentRef[REFERENCE];

  let children = parentRef.children;
  let child: Reference;

  if (children === null) {
    children = parentRef.children = new Map();
  } else {
    child = children.get(path)!;

    if (child !== undefined) {
      return child;
    }
  }

  if (type === UNBOUND) {
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
          return context().getProp(parent, path);
        }
      },
      (val) => {
        const parent = valueForRef(parentRef);

        if (isDict(parent)) {
          return context().setProp(parent, path, val);
        }
      }
    );

    if (import.meta.env.DEV) {
      child.debugLabel = `${parentRef.debugLabel}.${path}`;
    }
  }

  children.set(path, child);

  return child;
}

export function childRefFromParts(root: Reference, parts: string[]): Reference {
  let reference = root;

  for (const part of parts) {
    reference = childRefFor(reference, part);
  }

  return reference;
}

export let createDebugAliasRef: undefined | ((debugLabel: string, inner: Reference) => Reference);

if (import.meta.env.DEV) {
  createDebugAliasRef = (debugLabel: string, inner: Reference) => {
    const update = isUpdatableRef(inner) ? (value: unknown) => updateRef(inner, value) : null;
    const ref = createComputeRef(() => valueForRef(inner), update);

    ref[REFERENCE] = inner[REFERENCE];

    ref.debugLabel = debugLabel;

    return ref;
  };
}
