import { DEBUG } from '@glimmer/env';
import { assert, scheduleRevalidate } from '@glimmer/global-context';
import type {
  CacheSource,
  CACHE_SOURCE,
  Source,
  StorageSource,
  STORAGE_SOURCE,
} from '@glimmer/interfaces';
import {
  assertCacheNotConsumed,
  beginTrackingTransaction,
  endTrackingTransaction,
  markCacheAsConsumed,
  resetTrackingTransaction,
} from './debug';

const { max } = Math;
const { isArray } = Array;

//////////

export type Revision = number;

const enum Revisions {
  INITIAL = 1,
  CONSTANT = 0,
  UNINITIALIZED = -1,
}

let $REVISION = Revisions.INITIAL;

//////////

export const ALLOW_CYCLES: WeakMap<SourceImpl<any>, boolean> | undefined = DEBUG
  ? new WeakMap()
  : undefined;

export class SourceImpl<T = unknown> {
  declare [STORAGE_SOURCE]: T;
  declare [CACHE_SOURCE]: T;

  declare debuggingContext?: string;

  lastChecked = Revisions.UNINITIALIZED;
  value: T | undefined;

  // The goal here is that with a new Cache
  //   1. isConst(cache) === false
  //   2. isDirty(cache) === true
  //   3. if the cache is evaluated once, and has no dependencies or only
  //      constant dependencies, it becomes `isConst` true
  revision = Revisions.CONSTANT;
  valueRevision = Revisions.UNINITIALIZED;

  deps: SourceImpl<unknown> | SourceImpl<unknown>[] | null = null;

  compute: (() => T) | null = null;
  isEqual: ((oldValue: T, newValue: T) => boolean) | null = null;

  isUpdating = false;
}

export function isSourceImpl<T>(cache: Source<T> | unknown): cache is SourceImpl<T> {
  return cache instanceof SourceImpl;
}

function getRevision<T>(cache: SourceImpl<T>): Revision {
  let { lastChecked, revision: originalRevision } = cache;
  let revision = originalRevision;

  if (cache.isUpdating === true) {
    assert(ALLOW_CYCLES && ALLOW_CYCLES.has(cache), 'Cycles in caches are not allowed');

    cache.lastChecked = ++$REVISION;
  } else if (lastChecked !== $REVISION) {
    cache.isUpdating = true;
    cache.lastChecked = $REVISION;

    try {
      let { deps } = cache;

      if (deps !== null) {
        if (isArray(deps)) {
          for (let i = 0; i < deps.length; i++) {
            revision = max(revision, getRevision(deps[i]));
          }
        } else {
          revision = max(revision, getRevision(deps));
        }

        if (cache.valueRevision !== revision) {
          cache.revision = revision;
        } else {
          // If the last revision for the current value is equal to the current
          // revision, nothing has changed in our sub dependencies and so we
          // should return our last revision. See `addDeps` below for more
          // details.
          revision = originalRevision;
        }
      }
    } finally {
      cache.isUpdating = false;
    }
  }

  return revision;
}

function tripleEq(oldValue: unknown, newValue: unknown) {
  return oldValue === newValue;
}

function neverEq() {
  return false;
}

export function createStorage<T>(
  initialValue: T,
  isEqual: boolean | ((oldValue: T, newValue: T) => boolean) = tripleEq,
  debuggingContext?: string | false
): StorageSource<T> {
  let storage = new SourceImpl<T>();

  storage.value = initialValue;

  if (typeof isEqual === 'function') {
    storage.revision = Revisions.INITIAL;
    storage.isEqual = isEqual;
  } else if (isEqual === false) {
    storage.revision = Revisions.INITIAL;
    storage.isEqual = neverEq;
  }

  if (DEBUG && debuggingContext) {
    storage.debuggingContext = debuggingContext;
  }

  return storage;
}

export function createCache<T>(
  compute: (() => T) | null,
  debuggingContext?: string | false
): CacheSource<T> {
  assert(
    typeof compute === 'function' || compute === null,
    `createCache() must be passed a function or null as its first parameter. Called with: ${compute}`
  );

  let cache = new SourceImpl<T>();
  cache.compute = compute;

  if (DEBUG && debuggingContext) {
    cache.debuggingContext = debuggingContext;
  }

  return cache;
}

export function setDeps<T>(
  source: StorageSource<T>,
  value: T,
  deps: Source[] | Source | null
): void {
  assert(isSourceImpl(source), 'setDeps was passed a value that was not a cache or storage');
  assert(
    deps === null || isSourceImpl(deps) || (Array.isArray(deps) && deps.every(isSourceImpl)),
    'setDeps were passed deps a value that was not a cache or storage'
  );

  source.deps = deps;
  source.value = value;
  source.valueRevision = getRevision(source);
}

export function addDeps(cache: StorageSource, newDeps: Source[]): void {
  assert(isSourceImpl(cache), 'addDeps was passed a value that was not a cache or storage');
  assert(
    Array.isArray(newDeps) && newDeps.every(isSourceImpl),
    'addDeps were passed deps a value that was not a cache or storage'
  );

  let { deps } = cache;

  if (deps === null) {
    deps = [];
  } else if (!isArray(deps)) {
    deps = [deps];
  }

  let maxRevision = Revisions.INITIAL;

  for (let i = 0; i < newDeps.length; i++) {
    let newDep = newDeps[i];

    maxRevision = max(maxRevision, getRevision(newDep));
    deps.push(newDep);
  }

  // There are two different possibilities when updating a subcache:
  //
  // 1. cache.valueRevision <= getRevision(dep)
  // 2. cache.valueRevision > getRevision(dep)
  //
  // The first possibility is completely fine within our caching model, but
  // the second possibility presents a problem. If the parent tag has
  // already been read, then it's value is cached and will not update to
  // reflect the subtag's greater value. Next time the cache is busted, the
  // subtag's value _will_ be read, and it's value will be _greater_ than
  // the saved snapshot of the parent, causing the resulting calculation to
  // be rerun erroneously.
  //
  // In order to prevent this, when we first update to a new subtag we store
  // its computed value, and then check against that computed value on
  // subsequent updates. If its value hasn't changed, then we return the
  // parent's previous value. Once the subtag changes for the first time,
  // we clear the cache and everything is finally in sync with the parent.
  cache.valueRevision = max(cache.valueRevision, maxRevision);
  cache.deps = deps;
}

export function isDirty<T>(source: Source<T>): boolean {
  assert(
    isSourceImpl(source),
    `isDirty() can only be used on an instance of a cache created with createCache() or a storage created with createStorage(). Called with: ${source}`
  );

  return getRevision(source) > source.valueRevision;
}

export function isConst<T>(source: Source<T>): boolean {
  assert(
    isSourceImpl(source),
    `isConst() can only be used on an instance of a cache created with createCache() or a storage created with createStorage(). Called with: ${source}`
  );

  return getRevision(source) === Revisions.CONSTANT && !isDirty(source);
}

export function getValue<T>(source: Source<T>): T {
  assert(
    isSourceImpl<T>(source),
    `getValue() can only be used on an instance of a cache created with createCache() or a storage created with createStorage(). Called with: ${source}`
  );

  let { compute } = source;

  if (compute !== null) {
    if (beginCache(source)) {
      try {
        source.value = compute();
      } finally {
        endCache(source);
      }
    }
  } else if (CURRENT_TRACKER !== null) {
    CURRENT_TRACKER.add(source);
  }

  return source.value!;
}

type StorageValue<T extends StorageSource<unknown>> = T extends StorageSource<infer U> ? U : never;

export function setValue<T extends StorageSource<unknown>>(
  storage: T,
  value: StorageValue<T>
): void {
  assert(isSourceImpl(storage), 'isConst was passed a value that was not a cache or storage');
  assert(storage.revision !== Revisions.CONSTANT, 'Attempted to update a constant tag');
  assert(storage.compute === null, 'Attempted to setValue on a non-settable cache');

  if (DEBUG) {
    // Usually by this point, we've already asserted with better error information,
    // but this is our last line of defense.
    assertCacheNotConsumed!(storage);
  }

  let { value: oldValue, isEqual } = storage;

  assert(typeof isEqual === 'function', 'Attempted to set a storage without `isEqual`');

  if (isEqual(oldValue, value) === false) {
    storage.value = value;
    storage.revision = storage.valueRevision = ++$REVISION;
    scheduleRevalidate();
  }
}

const arrayFromSet =
  Array.from ||
  function <T>(set: Set<T>): T[] {
    let arr: T[] = [];
    set.forEach((v) => arr.push(v));
    return arr;
  };

/**
 * An object that that tracks @tracked properties that were consumed.
 */
class Tracker {
  private caches = new Set<SourceImpl<unknown>>();
  private last: SourceImpl<unknown> | null = null;

  add<T>(_cache: SourceImpl<T>) {
    let cache = _cache as SourceImpl<unknown>;

    if (isConst(cache)) return;

    this.caches.add(cache);

    if (DEBUG) {
      markCacheAsConsumed!(cache);
    }

    this.last = cache as SourceImpl<unknown>;
  }

  toDeps(): SourceImpl<unknown> | SourceImpl<unknown>[] | null {
    let { caches } = this;

    if (caches.size === 0) {
      return null;
    } else if (caches.size === 1) {
      return this.last;
    } else {
      return arrayFromSet(caches);
    }
  }
}

/**
 * Whenever a tracked computed property is entered, the current tracker is
 * saved off and a new tracker is replaced.
 *
 * Any tracked properties consumed are added to the current tracker.
 *
 * When a tracked computed property is exited, the tracker's tags are
 * combined and added to the parent tracker.
 *
 * The consequence is that each tracked computed property has a tag
 * that corresponds to the tracked properties consumed inside of
 * itself, including child tracked computed properties.
 */
let CURRENT_TRACKER: Tracker | null = null;

let OPEN_CACHES: (Tracker | null)[] = [];

export function beginCache<T>(cache: CacheSource<T>): boolean {
  assert(isSourceImpl(cache), 'passed a non-cache to beginCache');

  if (CURRENT_TRACKER !== null) {
    CURRENT_TRACKER.add(cache);
  }

  if (isDirty(cache)) {
    OPEN_CACHES.push(CURRENT_TRACKER);

    CURRENT_TRACKER = new Tracker();

    if (DEBUG) {
      beginTrackingTransaction!(cache.debuggingContext);
    }

    return true;
  }

  return false;
}

export function endCache<T>(cache: CacheSource<T>): void {
  assert(isSourceImpl(cache), 'passed a non-cache to beginCache');

  assert(CURRENT_TRACKER, 'Expected current to be a tracker');

  if (DEBUG) {
    assert(OPEN_CACHES.length > 0, 'attempted to close a tracking frame, but one was not open');

    endTrackingTransaction!();
  }
  // reset cache
  cache.deps = CURRENT_TRACKER.toDeps();
  cache.lastChecked = Revisions.UNINITIALIZED;

  // get current revision
  cache.valueRevision = getRevision(cache);

  CURRENT_TRACKER = OPEN_CACHES.pop() || null;
}

// untrack() is currently mainly used to handle places that were previously not
// tracked, and that tracking now would cause backtracking rerender assertions.
// I think once we move everyone forward onto modern APIs, we'll probably be
// able to remove it, but I'm not sure yet.
export function untrack<T>(callback: () => T): T {
  OPEN_CACHES.push(CURRENT_TRACKER);
  CURRENT_TRACKER = null;

  try {
    return callback();
  } finally {
    CURRENT_TRACKER = OPEN_CACHES.pop() || null;
  }
}

// This function is only for handling errors and resetting to a valid state
export function resetTracking(): string | void {
  OPEN_CACHES = [];
  CURRENT_TRACKER = null;

  if (DEBUG) {
    return resetTrackingTransaction!();
  }
}

export function isTracking(): boolean {
  return CURRENT_TRACKER !== null;
}

export function getDebugLabel(Source: Source) {
  assert(isSourceImpl(Source), 'Called getDebugLabel with a non-Source');

  return Source.debuggingContext;
}
