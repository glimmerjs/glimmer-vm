import { DEBUG } from '@glimmer/env';
import { getProp, setProp } from '@glimmer/global-context';
import { Option, Source } from '@glimmer/interfaces';
import { expect, isDict, _WeakSet } from '@glimmer/util';
import { createCache, getValue, getDebugLabel, createConstStorage } from '@glimmer/validator';

//////////

export function createPrimitiveSource(value: unknown): Source {
  return createConstStorage(value, DEBUG && String(value));
}

export const UNDEFINED_SOURCE = createPrimitiveSource(undefined);
export const NULL_SOURCE = createPrimitiveSource(null);
export const TRUE_SOURCE = createPrimitiveSource(true);
export const FALSE_SOURCE = createPrimitiveSource(false);

const UNBOUND_SOURCES = new _WeakSet();

export function createUnboundSource(value: unknown, debugLabel: false | string): Source {
  let source = createConstStorage(value, DEBUG && debugLabel);

  UNBOUND_SOURCES.add(source);

  return source;
}

const UPDATE_FUNCTIONS = new WeakMap<Source, (value: unknown) => void>();

export function createUpdatableCacheSource<T = unknown>(
  compute: () => T,
  update: Option<(value: T) => void> = null,
  debugLabel: false | string = 'unknown'
): Source<T> {
  let cache = createCache(compute, DEBUG && debugLabel);

  UPDATE_FUNCTIONS.set(cache, update as (value: unknown) => void);

  return cache;
}

export function createReadOnlySource(source: Source): Source {
  if (!isUpdatableSource(source)) return source;

  return createCache(() => getValue(source));
}

const INVOKABLE_SOURCES = new _WeakSet<Source>();

export function isInvokableSource(source: Source) {
  return INVOKABLE_SOURCES.has(source);
}

export function createInvokableSource(inner: Source): Source {
  let source = createUpdatableCacheSource(
    () => getValue(inner),
    (value) => updateSource(inner, value),
    getDebugLabel(inner)
  );

  INVOKABLE_SOURCES.add(source);

  return source;
}

export function isUpdatableSource(cache: Source): boolean {
  return UPDATE_FUNCTIONS.has(cache);
}

export function updateSource(source: Source, value: unknown) {
  let update = expect(UPDATE_FUNCTIONS.get(source), 'called update on a non-updatable source');

  update(value);
}

const CHILDREN = new WeakMap<Source, Map<string, Source>>();

export function pathSourceFor(parentSource: Source, path: string): Source {
  let children = CHILDREN.get(parentSource);
  let child: Source;

  if (children === undefined) {
    children = new Map();
    CHILDREN.set(parentSource, children);
  } else {
    child = children.get(path)!;

    if (child !== undefined) {
      return child;
    }
  }

  if (UNBOUND_SOURCES.has(parentSource)) {
    let parent = getValue(parentSource);

    if (isDict(parent)) {
      child = createUnboundSource(
        (parent as Record<string, unknown>)[path],
        DEBUG && `${getDebugLabel(parentSource)}.${path}`
      );
    } else {
      child = UNDEFINED_SOURCE;
    }
  } else {
    child = createUpdatableCacheSource(
      () => {
        let parent = getValue(parentSource);

        if (isDict(parent)) {
          return getProp(parent, path);
        }
      },
      (val) => {
        let parent = getValue(parentSource);

        if (isDict(parent)) {
          return setProp(parent, path, val);
        }
      },
      DEBUG && `${getDebugLabel(parentSource)}.${path}`
    );
  }

  children.set(path, child);

  return child;
}

export function pathSourceFromParts(root: Source, parts: string[]): Source {
  let source = root;

  for (let i = 0; i < parts.length; i++) {
    source = pathSourceFor(source, parts[i]);
  }

  return source;
}

export let createDebugAliasSource: undefined | ((debugLabel: string, inner: Source) => Source);

if (DEBUG) {
  createDebugAliasSource = (debugLabel: string, inner: Source) => {
    if (isUpdatableSource(inner)) {
      return createUpdatableCacheSource(
        () => getValue(inner),
        (value: unknown) => updateSource(inner, value),
        DEBUG && debugLabel
      );
    } else {
      return createCache(() => getValue(inner), DEBUG && debugLabel);
    }
  };
}
